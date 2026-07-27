/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {ChangeInfoDto, KeyInfo, ValueInfo} from './usecase-component.dto';

/**
 * Represents a usecase as returned by the API.
 */
export interface UsecaseDto {
  changeInfo: ChangeInfoDto;
  keyValueCollection: KeyValueInfo[];
  relatedEndPointLinks?: RelatedEndPointLink[];
  systemId: string;
  usecaseAliasId?: number;
  usecaseAliasName?: string;
  usecaseCategory?: string;
  usecaseType: 'Regular' | 'Manual';
}

/**
 * Identifies a subsystem group returned by the filtered-by-subsystem endpoint.
 */
export interface SubsystemFilteredKv {
  keyValueCollection: KeyValueInfo[];
}

export type UsecaseIdentifier = UsecaseDto;

export interface KeyValueInfo {
  keyInfo: KeyInfo;
  valueInfo: ValueInfo;
}

export interface RelatedEndPointLink {
  description: string;
  hypertextRef: string;
  method: string;
}

/**
 * Response shape from GET /projects/{id}/usecases/filtered-by-subsystem.
 * Each entry represents one subsystem group with its identifying key-value
 * info and the usecases that belong to it.
 */
export interface SubsystemFilteredUsecasesDto {
  filteredKv: SubsystemFilteredKv;
  usecases: UsecaseIdentifier[];
}
