#!/usr/bin/env python3

import datetime
import hashlib
import json
import proto.study_pb2 as study_pb2
import time
import proto.variations_seed_pb2 as variations_seed_pb2
import argparse
from packaging import version

SEED_BIN_PATH = "./seed.bin"
SERIALNUMBER_PATH = "./serialnumber"
TOTAL_PROBA = 100
PLATFORMS = set(["WINDOWS", "MAC", "LINUX", "IOS", "ANDROID"])
CHANNELS = set(["UNKNOWN", "NIGHTLY", "BETA", "RELEASE"])

SUPPORTED_CHANNELS = {
    'NIGHTLY': study_pb2.Study.Channel.CANARY,
    'DEV': study_pb2.Study.Channel.DEV,
    'BETA': study_pb2.Study.Channel.BETA,
    'RELEASE': study_pb2.Study.Channel.STABLE
}

PLATFORM_NAMES = {
    study_pb2.Study.Platform.PLATFORM_WINDOWS: 'windows',
    study_pb2.Study.Platform.PLATFORM_MAC: 'mac',
    study_pb2.Study.Platform.PLATFORM_LINUX: 'linux',
    study_pb2.Study.Platform.PLATFORM_IOS: 'ios',
    study_pb2.Study.Platform.PLATFORM_ANDROID: 'android'
}

def load(seed_json_path):
    with open(seed_json_path, "r") as file:
        seed_data = json.load(file)

    return seed_data


def validate(seed):
    for study in seed['studies']:
        total_proba = 0
        for experiment in study['experiments']:
            total_proba += experiment['probability_weight']

        if total_proba != TOTAL_PROBA:
            print("total_proba != ", TOTAL_PROBA)
            return False

        if not set(study['filter']['channel']).issubset(CHANNELS):
            print("channel not in ", CHANNELS)
            return False

        if not set(study['filter']['platform']).issubset(PLATFORMS):
            print("platform not in ", PLATFORMS)
            return False

    return True


def string_to_timestamp(time_string):
    # Assumes time_string is UTC and converts to unix timestamp
    dt = datetime.datetime.strptime(time_string, "%Y-%m-%d %H:%M:%S")
    return int(dt.replace(tzinfo=datetime.timezone.utc).timestamp())


def get_serial_number():
    ts = str(time.time()).encode('utf-8')
    m = hashlib.md5(ts)
    return m.hexdigest()


def update_serial_number(serialnumber):
    # Update `serialnumber` file for CI to be set in ETAG header
    with open(SERIALNUMBER_PATH, "w") as serial_number_file:
        serial_number_file.write(serialnumber)

    print("Updated serial number with %s in %s" %
          (serialnumber, SERIALNUMBER_PATH))


def make_variations_seed_message(seed_data):
    seed = variations_seed_pb2.VariationsSeed()
    seed.version = seed_data['version']
    serialnumber = get_serial_number()
    seed.serial_number = serialnumber
    update_serial_number(serialnumber)

    for study_data in seed_data['studies']:
        study = seed.study.add()
        study.name = study_data['name']
        study.consistency = study_pb2.Study.Consistency.PERMANENT
        study.activation_type = study_pb2.Study.ActivationType.ACTIVATE_ON_STARTUP

        for experiment_data in study_data['experiments']:
            experiment = study.experiment.add()
            experiment.name = experiment_data['name']
            experiment.probability_weight = experiment_data['probability_weight']

            if 'parameters' in experiment_data:
                for param_data in experiment_data['parameters']:
                    param = experiment.param.add()
                    param.name = param_data['name']
                    param.value = param_data['value']

            if 'feature_association' in experiment_data:
                if 'enable_feature' in experiment_data['feature_association']:
                    for feature in experiment_data['feature_association']['enable_feature']:
                        experiment.feature_association.enable_feature.append(feature)

                if 'disable_feature' in experiment_data['feature_association']:
                    for feature in experiment_data['feature_association']['disable_feature']:
                        experiment.feature_association.disable_feature.append(feature)

        for channel in study_data['filter']['channel']:
            study.filter.channel.append(SUPPORTED_CHANNELS[channel])

        for platform in study_data['filter']['platform']:
            supported_platforms = {
                'WINDOWS': study_pb2.Study.Platform.PLATFORM_WINDOWS,
                'MAC': study_pb2.Study.Platform.PLATFORM_MAC,
                'LINUX': study_pb2.Study.Platform.PLATFORM_LINUX,
                'IOS': study_pb2.Study.Platform.PLATFORM_IOS,
                'ANDROID': study_pb2.Study.Platform.PLATFORM_ANDROID
            }
            study.filter.platform.append(supported_platforms[platform])

        if 'country' in study_data['filter']:
            for country in study_data['filter']['country']:
                study.filter.country.append(country)

        if 'min_version' in study_data['filter']:
            study.filter.min_version = study_data['filter']['min_version']

        if 'max_version' in study_data['filter']:
            study.filter.max_version = study_data['filter']['max_version']

        if 'min_os_version' in study_data['filter']:
            study.filter.min_os_version = study_data['filter']['min_os_version']

        if 'max_os_version' in study_data['filter']:
            study.filter.max_os_version = study_data['filter']['max_os_version']

    return seed


def make_field_trial_testing_config(seed, version_string, channel_string):
    """Generate the most probable testing config in chromium format

    For a single study the experiment with maximum probability_weight will be
    chosen (the first one in the list if there are many of them).

    Filters that are processed here: min/max_version, channel.
    Filters to be ignored: min_os_version, county.
    Filters that will be processed by chromium code later: platforms

    The format description:
    https://chromium.googlesource.com/chromium/src/+/master/testing/variations/README.md
    """
    target_version = version.parse(version_string)
    target_channel = SUPPORTED_CHANNELS[channel_string]
    config = {}
    for study in seed.study:
        json_study = {}
        if (study.filter.min_version and
            target_version < version.parse(study.filter.min_version)):
            print('skip ' + study.name + ' because of min_version')
            continue
        if (study.filter.max_version and
            target_version > version.parse(study.filter.max_version)):
            print('skip ' + study.name + ' because of max_version')
            continue
        if study.filter.channel and not target_channel in study.filter.channel:
            print('skip ' + study.name + ' because of channel')
            continue

        if study.filter.platform:
            json_study['platforms'] = \
              [PLATFORM_NAMES[x] for x in study.filter.platform]

        # Find an experiment with max probability_weight:
        best_experiment = max(
            study.experiment, key=lambda x: x.probability_weight)

        study_number = str(len(config) + 1)
        experiments_json = {}
        experiments_json['name'] = 'e' + study_number
        experiments_json['full_name'] = best_experiment.name

        params_json = {}
        for param in best_experiment.param:
            params_json[param.name] = param.value
        if params_json:
            experiments_json['params'] = params_json

        enable_features = best_experiment.feature_association.enable_feature
        if enable_features:
            experiments_json['enable_features'] = [x for x in enable_features]

        disable_features = best_experiment.feature_association.disable_feature
        if disable_features:
            experiments_json['disable_features'] = [x for x in disable_features]

        json_study['experiments'] = [experiments_json]
        json_study['full_name'] = study.name

        config['s' + study_number] = [json_study]
    return config


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('seed_path', help='json seed file to process')
    parser.add_argument(
      '--fieldtrial-testing-config-path', type=str,
      help='Generate the most probable config and save to the provided path'
           'See src/testing/variations/README.md for details')
    parser.add_argument(
      '--target-version', type=str,
      help='The browser version in format [chrome_major].[brave_version]'
           '(used to process filters)')
    parser.add_argument(
      '--target-channel', type=str, choices=SUPPORTED_CHANNELS.keys(),
      help='The browser channel (used to process filters)')

    args = parser.parse_args()

    print("Load ", args.seed_path)
    seed_data = load(args.seed_path)

    print("Validate seed data")
    if validate(seed_data):
        seed_message = make_variations_seed_message(seed_data)
        if args.fieldtrial_testing_config_path:
            json_config = make_field_trial_testing_config(
                seed_message, args.target_version, args.target_channel)
            with open(args.fieldtrial_testing_config_path,
                      "w", encoding="utf8") as json_file:
                json.dump(json_config, json_file, indent=2)
            print("Testing config saved to",
                  args.fieldtrial_testing_config_path)
        else:
            # Serialize and save as seed file
            with open(SEED_BIN_PATH, "wb") as seed_file:
                seed_file.write(seed_message.SerializeToString())
            print("Seed data serialized and saved to ", SEED_BIN_PATH)

    else:
        print("Seed data is invalid")
