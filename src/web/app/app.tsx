// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

import { type StudyModel, type StudyListModel } from './study_model';
import { type FeatureModel, type ExperimentModel } from './experiment_model';
import {
  StudyPriority,
  type StudyFilter,
  priorityToText,
} from '../../core/study_processor';
import { SeedType } from '../../core/base_types';
import { loadSeedDataAsync } from './seed_loader';
import { SearchParamManager } from './search_param_manager';
import { variations as proto } from '../../proto/generated/proto_bundle';

function sanitizeUrl(url: string): string {
  if (!url.startsWith('https://')) return '#';
  return url;
}

export function FeatureItem(props: {
  feature: FeatureModel;
  filter: StudyFilter;
  className: string;
}) {
  return (
    <a
      className={props.className}
      target="blank"
      rel="noreferrer"
      href={sanitizeUrl(props.feature.link)}
    >
      {maybeHighlight(props.filter, props.feature.name)}
    </a>
  );
}

export function FeatureList(props: {
  title: string;
  filter: StudyFilter;
  className: string;
  features: FeatureModel[];
}) {
  if (props.features.length === 0) {
    return <></>;
  }
  const features = props.features.map((f) => (
    <li key={f.name}>
      <FeatureItem
        feature={f}
        filter={props.filter}
        className={props.className}
      />
    </li>
  ));
  return (
    <ul className="study-meta">
      <span>{props.title}: </span>
      {features}
    </ul>
  );
}

function maybeHighlight(filter: StudyFilter, text: string): JSX.Element {
  if (filter.searchRegexp === undefined) {
    return <>{text}</>;
  }
  const parts = text.split(filter.searchRegexp);
  return (
    <React.Fragment>
      {parts.map((part, i) => {
        const matched = filter.searchRegexp?.test(part);
        if (matched === true) return <mark key={i}>{part}</mark>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

export function ExperimentItem(props: {
  exp: ExperimentModel;
  filter: StudyFilter;
}) {
  const paramsList = props.exp.parameters().map((p) => <li key={p}>{p}</li>);
  const classes =
    'list-group-item ' +
    (props.exp.isMajorGroup() ? 'major-exp-item' : 'exp-item');
  return (
    <li className={classes}>
      {maybeHighlight(props.filter, props.exp.name())} ({props.exp.weight()}%)
      <FeatureList
        title="Enabled features"
        className="enabled-feature"
        filter={props.filter}
        features={props.exp.enabledFeatures()}
      />
      <FeatureList
        title="Disabled features"
        filter={props.filter}
        className="disabled-feature"
        features={props.exp.disabledFeatures()}
      />
      {paramsList.length > 0 && (
        <ul className="study-meta">
          <span>Parameters: </span>
          {paramsList}
        </ul>
      )}
    </li>
  );
}

export function PropertyList(props: {
  caption: string;
  list: string[] | null | undefined;
}) {
  if (props.list == null || props.list.length === 0) return <></>;
  return (
    <ul className="study-meta">
      <span>{props.caption}: </span>
      {props.list.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

export function BooleanProperty(props: {
  caption: string;
  value: boolean | null | undefined;
}) {
  if (props.value == null) return <></>;
  return PropertyList({
    caption: props.caption,
    list: [props.value ? 'True' : 'False'],
  });
}

export function IncludeExcludeList(props: {
  caption: string;
  include: string[] | null | undefined;
  exclude: string[] | null | undefined;
}) {
  return (
    <>
      <PropertyList caption={props.caption} list={props.include} />
      <PropertyList caption={'Exclude ' + props.caption} list={props.exclude} />
    </>
  );
}

export function StudyItem(props: { study: StudyModel; filter: StudyFilter }) {
  const filter = props.study.filter();
  const minVersion = filter?.min_version ?? '';
  const maxVersion = filter?.max_version ?? '';
  const minOsVersion = filter?.min_os_version ?? '';
  const maxOsVersion = filter?.max_os_version ?? '';
  const experiments = React.useMemo(
    () => props.study.filterExperiments(props.filter),
    [props.study, props.filter],
  );
  return (
    <div className="card mb-3">
      <div className="card-header">
        <a
          target="_blank"
          href={sanitizeUrl(props.study.getConfigUrl())}
          rel="noreferrer"
        >
          {maybeHighlight(props.filter, props.study.name())}
        </a>
      </div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {experiments.map((e) => (
            <ExperimentItem key={e.name()} exp={e} filter={props.filter} />
          ))}
        </ul>
      </div>
      <div className="card-footer">
        {(minVersion !== '' || maxVersion !== '') && (
          <div className="study-meta">
            Version range:[ {minVersion !== '' ? minVersion : 'any'} -{' '}
            {maxVersion !== '' ? maxVersion : 'any'}]
          </div>
        )}
        {(minOsVersion !== '' || maxOsVersion !== '') && (
          <div className="study-meta">
            OS version range:[ {minOsVersion !== '' ? minOsVersion : 'any'} -{' '}
            {maxOsVersion !== '' ? maxOsVersion : 'any'}]
          </div>
        )}
        <PropertyList caption="Channels" list={props.study.channels()} />
        <PropertyList caption="Platforms" list={props.study.platforms()} />
        <IncludeExcludeList
          caption="Countries"
          include={filter?.country}
          exclude={filter?.exclude_country}
        />
        <IncludeExcludeList
          caption="Hardware class"
          include={filter?.hardware_class}
          exclude={filter?.exclude_hardware_class}
        />
        <IncludeExcludeList
          caption="Google group"
          include={filter?.google_group?.map((e) => e.toString())}
          exclude={filter?.exclude_google_group?.map((e) => e.toString())}
        />
        <IncludeExcludeList
          caption="Form factor"
          include={filter?.form_factor?.map((e) => proto.Study.FormFactor[e])}
          exclude={filter?.exclude_form_factor?.map(
            (e) => proto.Study.FormFactor[e],
          )}
        />
        <IncludeExcludeList
          caption="CPU architecture"
          include={filter?.cpu_architecture?.map(
            (e) => proto.Study.CpuArchitecture[e],
          )}
          exclude={filter?.exclude_cpu_architecture?.map(
            (e) => proto.Study.CpuArchitecture[e],
          )}
        />
        {filter != null &&
          Boolean(Object.hasOwn(filter, 'is_low_end_device')) &&
          BooleanProperty({
            caption: 'Low-end device',
            value: filter?.is_low_end_device,
          })}
        {filter != null &&
          Boolean(Object.hasOwn(filter, 'is_enterprise')) &&
          BooleanProperty({
            caption: 'Enterprise',
            value: filter?.is_enterprise,
          })}
      </div>
    </div>
  );
}

export function NavItem(props: {
  type: SeedType;
  searchParamManager: SearchParamManager;
}) {
  const paramManager = props.searchParamManager;
  const className =
    (props.type === paramManager.currentSeed ? 'active ' : '') +
    'nav-item nav-link btn-sm';
  return (
    <a
      onClick={paramManager.setSeedType.bind(paramManager, props.type)}
      className={className}
    >
      {SeedType[props.type]}
    </a>
  );
}

export function FilterCheckbox(props: {
  title: string;
  htmlName: string;
  checked: boolean;
  toggle: () => void;
}) {
  return (
    <div className="filter">
      <label>
        <input
          type="checkbox"
          className="filter-checkbox"
          checked={props.checked}
          onChange={props.toggle}
        />
        {props.title}
      </label>
    </div>
  );
}

export function PriorityFilter(props: {
  priority: number;
  setPriority: (newPos: number) => void;
}) {
  const optionsList = Object.values(StudyPriority)
    .filter((v): v is StudyPriority => {
      return typeof v !== 'string';
    })
    .map((v) => (
      <option value={v} key={v}>
        {priorityToText(v)}
      </option>
    ));

  return (
    <div className="filter">
      <label>
        Min priority
        <select
          value={props.priority}
          onInput={(e) => {
            const target = e.target as HTMLSelectElement;
            props.setPriority(parseInt(target.value));
          }}
        >
          ${optionsList}
        </select>
      </label>
    </div>
  );
}

export function FilterSearch(props: {
  search: string | undefined;
  setSearch: (search: string) => void;
}) {
  return (
    <div className="filter filter-left">
      <label>
        Search
        <input
          value={props.search}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            props.setSearch(target.value);
          }}
        />
      </label>
    </div>
  );
}

export function CurrentStudyList(props: {
  studies: Map<SeedType, StudyListModel>;
  searchParamManager: SearchParamManager;
}) {
  const paramManager = props.searchParamManager;
  const studies = React.useMemo(
    () =>
      props.studies
        .get(paramManager.currentSeed)
        ?.filterStudies(paramManager.filter),
    [props.studies, paramManager.currentSeed, paramManager.filter],
  );

  const studyList = studies?.map((study, i) => (
    <StudyItem key={study.id} study={study} filter={paramManager.filter} />
  ));

  return (
    <div className="row">
      <div className="col-sm-12">
        <div className="card mb-3">
          <div className="card-header filter-list">
            <FilterCheckbox
              title="Show empty groups"
              htmlName="showEmptyGroups"
              checked={paramManager.filter.showEmptyGroups}
              toggle={paramManager.toggleShowEmptyGroups.bind(paramManager)}
            />
            <FilterCheckbox
              title="Show outdated studies"
              htmlName="includeOutdated"
              checked={paramManager.filter.includeOutdated}
              toggle={paramManager.toggleIncludeOutdated.bind(paramManager)}
            />
            <PriorityFilter
              priority={paramManager.filter.minPriority}
              setPriority={paramManager.setMinPriority.bind(paramManager)}
            />
            <FilterSearch
              search={paramManager.filter.search}
              setSearch={paramManager.setSearch.bind(paramManager)}
            />
          </div>
        </div>
        {studyList}
      </div>
    </div>
  );
}

class AppState {
  studies = new Map<SeedType, StudyListModel>();
}

export function App() {
  const [state, setState] = React.useState(new AppState());
  const updateState = (type: SeedType, studyList: StudyListModel) => {
    setState((prevState) => {
      const newState: AppState = { ...prevState };
      newState.studies.set(type, studyList);
      return newState;
    });
  };
  React.useEffect(() => {
    loadSeedDataAsync(updateState);
  }, []);

  const searchParams = useSearchParams();
  const searchParamManager = React.useMemo(
    () => new SearchParamManager(searchParams),
    [searchParams],
  );

  const hasUpstream = state.studies.get(SeedType.UPSTREAM) !== undefined;

  return (
    <div className="container" id="app">
      <section className="navbar navbar-light bg-light">
        <a className="heading" href=".">
          <h1>Brave Variations</h1>
        </a>
        <nav className="nav nav-pills">
          <NavItem
            type={SeedType.PRODUCTION}
            searchParamManager={searchParamManager}
          />
          <NavItem
            type={SeedType.STAGING}
            searchParamManager={searchParamManager}
          />
          {hasUpstream && (
            <NavItem
              type={SeedType.UPSTREAM}
              searchParamManager={searchParamManager}
            />
          )}
        </nav>
      </section>
      <main>
        <CurrentStudyList
          studies={state.studies}
          searchParamManager={searchParamManager}
        />
      </main>
    </div>
  );
}
