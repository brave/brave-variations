#! /usr/bin/python

import datetime
import hashlib
import json
from pydoc import describe
import proto.study_pb2 as study_pb2
import sys
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
    'UNKNOWN': study_pb2.Study.Channel.UNKNOWN,
    'NIGHTLY': study_pb2.Study.Channel.CANARY,
    'DEV': study_pb2.Study.Channel.DEV,
    'BETA': study_pb2.Study.Channel.BETA,
    'RELEASE': study_pb2.Study.Channel.STABLE
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
    with open(SERIALNUMBER_PATH, "w") as file:
        file.write(serialnumber)
        file.close()

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


def makeFieldTrialTestingConfig(seed, version_string, channel_string):
    target_version = version.parse(version_string)
    target_channel = SUPPORTED_CHANNELS[channel_string]
    config = {}
    exp_count = 0
    for study in seed.study:
        json_study = {}
        if study.filter.min_version and target_version < version.parse(study.filter.min_version):
            print('skip ' + study.name + ' because of min_version')
            continue
        if study.filter.max_version and target_version > version.parse(study.filter.max_version):
            print('skip ' + study.name + ' because of max_version')
            continue
        if len(study.filter.channel) != 0 and \
                not target_channel in study.filter.channel:
            print('skip ' + study.name + ' because of channel')
            continue

        if len(study.filter.platform) != 0:
            platforms_json = []
            platform_names = {
                study_pb2.Study.Platform.PLATFORM_WINDOWS: 'windows',
                study_pb2.Study.Platform.PLATFORM_MAC: 'mac',
                study_pb2.Study.Platform.PLATFORM_LINUX: 'linux',
                study_pb2.Study.Platform.PLATFORM_IOS: 'ios',
                study_pb2.Study.Platform.PLATFORM_ANDROID: 'android'
            }
            for platform in study.filter.platform:
                platforms_json.append(platform_names[platform])
            json_study['platforms'] = platforms_json

        experiments_json = {}
        best_experiment = max(
            study.experiment, key=lambda x: x.probability_weight)

        exp_count += 1
        experiments_json['name'] = 'e' + str(exp_count)
        experiments_json['full_name'] = best_experiment.name

        params_json = {}
        for param in best_experiment.param:
            params_json[param.name] = param.value
        if params_json != {}:
            experiments_json['params'] = params_json

        enable_features_json = []
        disable_features_json = []

        for enable_feature in best_experiment.feature_association.enable_feature:
            enable_features_json.append(enable_feature)
        if len(enable_features_json) != 0:
            experiments_json['enable_features'] = enable_features_json

        for disable_feature in best_experiment.feature_association.disable_feature:
            disable_features_json.append(disable_feature)
        if len(disable_features_json) != 0:
            experiments_json['disable_features'] = disable_features_json

        json_study['experiments'] = [experiments_json]
        json_study['full_name'] = study.name

        study_name = 's' + str(len(config) + 1)
        config[study_name] = [json_study]
    return config


if __name__ == "__main__":
    print("Load seed.json")
    parser = argparse.ArgumentParser()
    parser.add_argument('seed_path', help='json seed file to process')
    parser.add_argument(
      '--fieldtrial-testing-config-path', type=str,
      default='fieldtrial_testing_config.json',
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
    seed_data = load(args.seed_path)

    print("Validate seed data")
    if validate(seed_data):
        seed = make_variations_seed_message(seed_data)
        if args.fieldtrial_testing_config_path:
            ft = makeFieldTrialTestingConfig(
                seed, args.target_version, args.target_channel)
            with open(args.fieldtrial_testing_config_path,
                      "w", encoding="utf8") as json_file:
                json.dump(ft, json_file, indent=2)
            print("Config saved to ", args.fieldtrial_testing_config_path)
        else:
            # Serialize and save as seed file
            with open(SEED_BIN_PATH, "wb") as file:
                file.write(seed.SerializeToString())
                file.close()
            print("Seed data serialized and saved to ", SEED_BIN_PATH)

    else:
        print("Seed data is invalid")
