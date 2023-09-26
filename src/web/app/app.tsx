// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

import { type StudyModel, type StudyListModel } from './study_model';
import { type FeatureModel, type ExperimentModel } from './experiment_model';
import { type StudyFilter } from '../../core/study_processor';
import { SeedType } from '../../core/base_types';
import { loadSeedDataAsync } from './seed_loader';
import { SearchParamManager } from './search_param_manager';

function sanitizeUrl(url: string): string {
  if (!url.startsWith('https://')) return '#';
  return url;
}

export function FeatureItem(props: {
  feature: FeatureModel;
  className: string;
}) {
  return (
    <a
      className={props.className}
      target="blank"
      rel="noreferrer"
      href={sanitizeUrl(props.feature.link)}
    >
      {props.feature.name}
    </a>
  );
}

export function FeatureList(props: {
  title: string;
  className: string;
  features: FeatureModel[];
}) {
  if (props.features.length === 0) {
    return <></>;
  }
  const features = props.features.map((f) => (
    <li key={f.name}>
      <FeatureItem feature={f} className={props.className} />
    </li>
  ));
  return (
    <ul className="study-meta">
      <span>{props.title}: </span>
      {features}
    </ul>
  );
}

export function ExperimentItem(props: { exp: ExperimentModel }) {
  const paramsList = props.exp.parameters().map((p) => <li key={p}>{p}</li>);
  const classes =
    'list-group-item ' +
    (props.exp.isMajorGroup() ? 'major-exp-item' : 'exp-item');
  return (
    <li className={classes}>
      {props.exp.name()} ({props.exp.weight()}%)
      <FeatureList
        title="Enabled features"
        className="enabled-feature"
        features={props.exp.enabledFeatures()}
      />
      <FeatureList
        title="Disabled features"
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

export function IncludeExcludeList(props: {
  caption: string;
  include: string[] | null | undefined;
  exclude: string[] | null | undefined;
}) {
  return (
    <>
      <PropertyList caption={props.caption} list={props.include} />
      <PropertyList caption={'Exclude' + props.caption} list={props.exclude} />
    </>
  );
}

export function StudyItem(props: { study: StudyModel; filter: StudyFilter }) {
  const filter = props.study.filter();
  const minVersion = filter?.min_version ?? '';
  const maxVersion = filter?.max_version ?? '';
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
          {props.study.name()}
        </a>
      </div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {experiments.map((e) => (
            <ExperimentItem key={e.name()} exp={e} />
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
          checked={props.checked}
          onChange={props.toggle}
        />
        {props.title}
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
        <h1>Brave Variations</h1>
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
