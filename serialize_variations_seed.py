#! /usr/bin/python
import json
import variations_seed_pb2
import study_pb2
import sys
import datetime

SEED_JSON_PATH = "./seed.json"
SEED_BIN_PATH = "./seed"
MAX_STUDIES = 1
CONSISTENCY = "permanent"
MIN_PROBA = 10
TOTAL_PROBA = 100
PLATFORMS = set(["WINDOWS", "MAC", "LINUX", "IOS", "ANDROID"])
COUNTRIES = set(["us", "gb", "fr", "in", "de"])
CHANNELS = set(["UNKNOWN", "STABLE"])


def load(seed_json_path):
    with open(seed_json_path, "r") as file:
        seed_data = json.load(file)

    return seed_data


def validate(seed):
    if len(seed['studies']) > MAX_STUDIES:
        print("number of studies > ", MAX_STUDIES)
        return False

    for study in seed['studies']:
        total_proba = 0
        for experiment in study['experiments']:
            if experiment['probability_weight'] < MIN_PROBA:
                print("probability_weight < ", MIN_PROBA)
                return False

            total_proba += experiment['probability_weight']

        if total_proba > TOTAL_PROBA:
            print("total_proba > ", TOTAL_PROBA)
            return False

        if not set(study['filter']['channel']).issubset(CHANNELS):
            print("channel not in ", CHANNELS)
            return False

        if not set(study['filter']['country']).issubset(COUNTRIES):
            print("country not in ", COUNTRIES)
            return False

        if not set(study['filter']['platform']).issubset(PLATFORMS):
            print("platform not in ", PLATFORMS)
            return False

    return True


def string_to_timestamp(time_string):
    # Assumes time_string is UTC and converts to unix timestamp
    dt = datetime.datetime.strptime(time_string, "%Y-%m-%d %H:%M:%S")
    return int(dt.replace(tzinfo=datetime.timezone.utc).timestamp())


def serialize_and_save_variations_seed_message(seed_data, path):
    seed = variations_seed_pb2.VariationsSeed()
    seed.version = seed_data['version']
    seed.serial_number = seed_data['serial_number']

    for study_data in seed_data['studies']:
        study = seed.study.add()
        study.name = study_data['name']
        study.consistency = study_pb2.Study.Consistency.PERMANENT
        study.activation_type = study_pb2.Study.ActivationType.ACTIVATE_ON_STARTUP

        for experiment_data in study_data['experiments']:
            experiment = study.experiment.add()
            experiment.name = experiment_data['name']
            experiment.probability_weight = experiment_data['probability_weight']

            for param_data in experiment_data['parameters']:
                param = experiment.param.add()
                param.name = param_data['name']
                param.value = param_data['value']

            for feature in experiment_data['feature_association']['enable_feature']:
                experiment.feature_association.enable_feature.append(feature)

            for feature in experiment_data['feature_association']['disable_feature']:
                experiment.feature_association.disable_feature.append(feature)

        # if study_data['filter']['start_date_utc']:
        #     study.filter.start_date = string_to_timestamp(study_data['filter']['start_date_utc'])

        # if study_data['filter']['end_date_utc']:
        #     study.filter.end_date = string_to_timestamp(study_data['filter']['end_date_utc'])

        for channel in study_data['filter']['channel']:
            supported_channels = {
                'UNKNOWN': study_pb2.Study.Channel.UNKNOWN,
                'CANARY': study_pb2.Study.Channel.CANARY,
                'DEV': study_pb2.Study.Channel.DEV,
                'BETA': study_pb2.Study.Channel.BETA,
                'STABLE': study_pb2.Study.Channel.STABLE
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

        for country in study_data['filter']['country']:
            study.filter.country.append(country)

    # Serialize and save
    with open(path, "wb") as file:
        file.write(seed.SerializeToString())
        file.close()


if __name__ == "__main__":
    print("Load seed.json")
    seed_data = load(SEED_JSON_PATH)

    print("Validate seed data")
    if validate(seed_data):
        serialize_and_save_variations_seed_message(seed_data, SEED_BIN_PATH)
        print("Seed data serialized and saved to ", SEED_BIN_PATH)
    else:
        print("Seed data is invalid")
