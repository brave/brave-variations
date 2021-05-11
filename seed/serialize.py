#! /usr/bin/python

import datetime
import hashlib
import json
import proto.study_pb2 as study_pb2
import sys
import time
import proto.variations_seed_pb2 as variations_seed_pb2

SEED_BIN_PATH = "./seed.bin"
SERIALNUMBER_PATH = "./serialnumber"
TOTAL_PROBA = 100
PLATFORMS = set(["WINDOWS", "MAC", "LINUX", "IOS", "ANDROID"])
CHANNELS = set(["UNKNOWN", "NIGHTLY", "BETA", "RELEASE"])
ADS_TRIAL_STRING = "BraveAds"
ALLOWED_ADS_STUDIES = 1


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

    num_ads_studies = 0
    for study in seed['studies']:
        if ADS_TRIAL_STRING in study['name']:
            num_ads_studies += 1

    # NOTE: Before increasing ALLOWED_ADS_STUDIES a security review is required
    if num_ads_studies > ALLOWED_ADS_STUDIES:
        print("Only", ALLOWED_ADS_STUDIES, "*BraveAds* studies allowed")
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

    print("Updated serial number with %s in %s" % (serialnumber, SERIALNUMBER_PATH))


def serialize_and_save_variations_seed_message(seed_data, path):
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
            supported_channels = {
                'UNKNOWN': study_pb2.Study.Channel.UNKNOWN,
                'NIGHTLY': study_pb2.Study.Channel.CANARY,
                'DEV': study_pb2.Study.Channel.DEV,
                'BETA': study_pb2.Study.Channel.BETA,
                'RELEASE': study_pb2.Study.Channel.STABLE
            }
            study.filter.channel.append(supported_channels[channel])

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

    # Serialize and save
    with open(path, "wb") as file:
        file.write(seed.SerializeToString())
        file.close()


if __name__ == "__main__":
    print("Load seed.json")
    seed_data = load(sys.argv[1])

    print("Validate seed data")
    if validate(seed_data):
        serialize_and_save_variations_seed_message(seed_data, SEED_BIN_PATH)
        print("Seed data serialized and saved to ", SEED_BIN_PATH)
    else:
        print("Seed data is invalid")
