#!/usr/bin/env python3
# Copyright (c) 2022 The Brave Authors. All rights reserved.
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# you can obtain one at https://mozilla.org/MPL/2.0/.

import datetime
import hashlib
import sys
import json
import proto.study_pb2 as study_pb2
import time
import proto.variations_seed_pb2 as variations_seed_pb2
import argparse

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

        if 'locale' in study_data['filter']:
            for locale in study_data['filter']['locale']:
                study.filter.locale.append(locale)

        if 'exclude_locale' in study_data['filter']:
            for exclude_locale in study_data['filter']['exclude_locale']:
                study.filter.exclude_locale.append(exclude_locale)

        if 'exclude_locale' in study_data['filter']:
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

    return seed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
      'seed_path', type=argparse.FileType('r'), nargs='?',
      help='json seed file to process')
    args = parser.parse_args()

    print("Load", args.seed_path.name)
    seed_data = json.load(args.seed_path)

    print("Validate seed data")
    if not validate(seed_data):
        print("Seed data is invalid")
        return -1
    seed_message = make_variations_seed_message(seed_data)
    update_serial_number(seed_message.serial_number)

    # Serialize and save as seed file
    with open(SEED_BIN_PATH, "wb") as seed_file:
        seed_file.write(seed_message.SerializeToString())
    print("Seed data serialized and saved to ", SEED_BIN_PATH)
    return 0

if __name__ == "__main__":
    sys.exit(main())
