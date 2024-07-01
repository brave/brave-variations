#! /usr/bin/python

import datetime
import hashlib
import json
import proto.study_pb2 as study_pb2
import sys
import time
import proto.variations_seed_pb2 as variations_seed_pb2
import collections

SEED_BIN_PATH = "./seed.bin"
SERIALNUMBER_PATH = "./serialnumber"
TOTAL_PROBA = 100
PLATFORMS = set(["WINDOWS", "MAC", "LINUX", "IOS", "ANDROID"])
CHANNELS = set(["UNKNOWN", "NIGHTLY", "BETA", "RELEASE"])


def load(seed_json_path):
    with open(seed_json_path, "r") as file:
        seed_data = json.load(file)

    return seed_data


def version_to_int_array(version_str):
    version_list = []
    if version_str is None:
        return version_list

    parts = version_str.split('.')
    for part in parts:
        if part == '*':
            version_list.append(part)
            break
        version_list.append(int(part))

    return version_list

def compare_versions(version1, version2):
    min_len = None
    if not version1:
        min_len = 0
    elif version1[-1] == '*':
        version1 = version1[:-1]
        min_len = len(version1)

    if not version2:
        min_len = 0
    elif version2[-1] == '*':
        version2 = version2[:-1]
        if min_len is not None:
            min_len = min(min_len, len(version2))
        else:
            min_len = len(version2)

    if min_len is not None:
        version1 = version1[:min_len]
        version2 = version2[:min_len]

    if version1 > version2:
        return 1
    elif version1 < version2:
        return -1
    else:
        return 0

def test_version_comparison():
    # //base/version_unittest.cc VersionTest.CompareToWildcardString
    test_cases = [
        ["1.0", "1.*", 0],
        ["1.0", "0.*", 1],
        ["1.0", "2.*", -1],
        ["1.2.3", "1.2.3.*", 0],
        ["10.0", "1.0.*", 1],
        ["1.0", "3.0.*", -1],
        ["1.4", "1.3.0.*", 1],
        ["1.3.9", "1.3.*", 0],
        ["1.4.1", "1.3.*", 1],
        ["1.3", "1.4.5.*", -1],
        ["1.5", "1.4.5.*", 1],
        ["1.3.9", "1.3.*", 0],
        ["1.2.0.0.0.0", "1.2.*", 0],
        [None, None, 0],
        [None, "1", 0],
        ["1", None, 0],
    ]
    for test_case in test_cases:
        version1 = version_to_int_array(test_case[0])
        version2 = version_to_int_array(test_case[1])
        assert compare_versions(version1, version2) == test_case[2]

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

    feature_names_to_studies = collections.defaultdict(list)
    for study in seed['studies']:
        used_feature_names = set()
        for experiment in study['experiments']:
            feature_association = experiment.get('feature_association')
            if feature_association:
                for enable_feature in feature_association.get('enable_feature', []):
                    used_feature_names.add(enable_feature)
                for disable_feature in feature_association.get('disable_feature', []):
                    used_feature_names.add(disable_feature)

        for used_feature_names in used_feature_names:
            feature_names_to_studies[used_feature_names].append(study)

    def get_study_platforms(study):
        return set(study.get('filter', {}).get('platform', []))

    def get_study_channels(study):
        return set(study.get('filter', {}).get('channel', []))

    def get_study_version_range(study):
        return [
            version_to_int_array(study.get('filter', {}).get('min_version')),
            version_to_int_array(study.get('filter', {}).get('max_version')),
        ]

    def is_filter_set_intersect(a, b):
        return not a or not b or a.intersection(b)

    def is_version_range_intersect(range1, range2):
        return compare_versions(range1[1], range2[0]) >= 0 and compare_versions(range2[1], range1[0]) >= 0

    test_version_comparison()
    for studies in feature_names_to_studies.values():
        for i, study1 in enumerate(studies):
            study1_platform = get_study_platforms(study1)
            study1_channel = get_study_channels(study1)
            study1_version_range = get_study_version_range(study1)
            for j in range(i + 1, len(studies)):
                study2 = studies[j]
                study2_platform = get_study_platforms(study2)
                study2_channel = get_study_channels(study2)
                study2_version_range = get_study_version_range(study2)
                # Check if the studies overlap in platform
                if is_filter_set_intersect(study1_platform, study2_platform):
                    # Check if the studies overlap in channel
                    if is_filter_set_intersect(study1_channel, study2_channel):
                        # Check if the studies overlap in version
                        if is_version_range_intersect(study1_version_range, study2_version_range):
                            raise ValueError(f"Studies overlap:\n{json.dumps(study1, indent=2)}\n\n{json.dumps(study2, indent=2)}")

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

    supported_optional_bool = {
        'OPTIONAL_BOOL_MISSING': study_pb2.Study.OptionalBool.OPTIONAL_BOOL_MISSING,
        'OPTIONAL_BOOL_TRUE': study_pb2.Study.OptionalBool.OPTIONAL_BOOL_TRUE,
        'OPTIONAL_BOOL_FALSE': study_pb2.Study.OptionalBool.OPTIONAL_BOOL_FALSE
    }

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

        if 'start_date' in study_data['filter']:
            study.filter.start_date = study_data['filter']['start_date']

        if 'end_date' in study_data['filter']:
            study.filter.end_date = study_data['filter']['end_date']

        if 'min_version' in study_data['filter']:
            study.filter.min_version = study_data['filter']['min_version']

        if 'max_version' in study_data['filter']:
            study.filter.max_version = study_data['filter']['max_version']

        if 'min_os_version' in study_data['filter']:
            study.filter.min_os_version = study_data['filter']['min_os_version']

        if 'max_os_version' in study_data['filter']:
            study.filter.max_os_version = study_data['filter']['max_os_version']

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

        if 'locale' in study_data['filter']:
            for locale in study_data['filter']['locale']:
                study.filter.locale.append(locale)

        if 'exclude_locale' in study_data['filter']:
            for exclude_locale in study_data['filter']['exclude_locale']:
                study.filter.exclude_locale.append(exclude_locale)

        if 'form_factor' in study_data['filter']:
            for form_factor in study_data['filter']['form_factor']:
                supported_form_factors = {
                    'DESKTOP': study_pb2.Study.FormFactor.DESKTOP,
                    'PHONE': study_pb2.Study.FormFactor.PHONE,
                    'TABLET': study_pb2.Study.FormFactor.TABLET
                }
                study.filter.form_factor.append(supported_form_factors[form_factor])

        if 'exclude_form_factor' in study_data['filter']:
            for exclude_form_factor in study_data['filter']['exclude_form_factor']:
                supported_form_factors = {
                    'DESKTOP': study_pb2.Study.FormFactor.DESKTOP,
                    'PHONE': study_pb2.Study.FormFactor.PHONE,
                    'TABLET': study_pb2.Study.FormFactor.TABLET,
                    'KIOSK': study_pb2.Study.FormFactor.KIOSK
                }
                study.filter.exclude_form_factor.append(supported_form_factors[exclude_form_factor])

        if 'hardware_class' in study_data['filter']:
            for hardware_class in study_data['filter']['hardware_class']:
                study.filter.hardware_class.append(hardware_class)

        if 'exclude_hardware_class' in study_data['filter']:
            for exclude_hardware_class in study_data['filter']['exclude_hardware_class']:
                study.filter.exclude_hardware_class.append(exclude_hardware_class)

        if 'country' in study_data['filter']:
            for country in study_data['filter']['country']:
                study.filter.country.append(country)

        if 'exclude_country' in study_data['filter']:
            for exclude_country in study_data['filter']['exclude_country']:
                study.filter.exclude_country.append(exclude_country)

        if 'is_low_end_device' in study_data['filter']:
            study.filter.is_low_end_device = supported_optional_bool[study_data['filter']['is_low_end_device']];

        if 'is_enterprise' in study_data['filter']:
            study.filter.is_enterprise = supported_optional_bool[study_data['filter']['is_enterprise']];

        if 'policy_restriction' in study_data['filter']:
            supported_policy_restrictions = {
                'NONE': study_pb2.Study.PolicyRestriction.NONE,
                'CRITICAL': study_pb2.Study.PolicyRestriction.CRITICAL,
                'CRITICAL_ONLY': study_pb2.Study.PolicyRestriction.CRITICAL_ONLY
            }
            study.filter.policy_restriction = supported_form_factors[study_data['filter']['policy_restriction']];

    # Serialize and save
    with open(path, "wb") as file:
        file.write(seed.SerializeToString())
        file.close()


if __name__ == "__main__":
    print("Load seed.json")
    seed_data = load(sys.argv[1])
    seed_data['studies'].sort(key=lambda study: study['name'])

    print("Validate seed data")
    if validate(seed_data):
        serialize_and_save_variations_seed_message(seed_data, SEED_BIN_PATH)
        print("Seed data serialized and saved to ", SEED_BIN_PATH)
    else:
        print("Seed data is invalid")
