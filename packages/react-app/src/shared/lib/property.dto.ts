/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

export type PropertyDisplayType =
  | 'BIT_FIELD'
  | 'CHECK_BOX'
  | 'DB_TEXT_BOX'
  | 'DROP_DOWN'
  | 'DUMP'
  | 'FILE'
  | 'FORMULA'
  | 'Q_FORMATTED_VALUE'
  | 'SLIDER'
  | 'STRING_FIELD'
  | 'TEXT_BOX';

export type PropertyPolicy = 'ADVANCED' | 'BASIC' | 'HIDDEN';

export interface NameValuePairDto {
  name: string;
  type: 'NAME_VALUE_PAIR';
  value: string;
}

export interface BitFieldDto {
  allowedValues: NameValuePairDto[];
  bitMask: string;
  description?: string;
  name: string;
  type: 'BIT_FIELD';
}

export interface ConfigElementDto {
  allowedValues?: (BitFieldDto | NameValuePairDto)[];
  description?: string;
  displayType?: PropertyDisplayType;
  group?: string;
  isReadOnly: boolean;
  linkedElementNames?: string[];
  max?: number;
  min?: number;
  name: string;
  policy?: PropertyPolicy;
  precision?: number;
  qFormat?: string;
  subgroup?: string;
  type: 'CONFIG_ELEMENT';
  unit?: string;
  value: string;
}

export interface ElementTemplateArrayDto {
  description?: string;
  group?: string;
  isReadOnly: boolean;
  length?: number;
  lengthFormula?: string;
  name: string;
  subgroup?: string;
  template: PropertyElement[];
  type: 'ELEMENT_TEMPLATE_ARRAY';
  value: PropertyElement[];
}

export interface StructDto {
  description?: string;
  group?: string;
  isReadOnly: boolean;
  name: string;
  structType: string;
  subgroup?: string;
  type: 'STRUCT';
  value: PropertyElement[];
}

export type PropertyElement =
  | ConfigElementDto
  | ElementTemplateArrayDto
  | StructDto;

export interface PropertyDto {
  definitionLink?: {href: string; rel: string};
  elements: PropertyElement[];
  hasDefinition: boolean;
  propertyId: number;
  propertyName: string;
  systemId: string;
}

// NOTE: ControlLinkIntentsDto and ControlLinkHeapIdDto shapes from PR #75
// appear incomplete — verify full intent/heap structure with the backend
// team before implementing the control link card.
export interface ControlLinkIntentsDto {
  propId: number;
}

export interface ControlLinkHeapIdDto {
  propId: number;
}

export interface ControlLinkPropertiesDto {
  AllocatedIntents: ControlLinkIntentsDto;
  HeapId: ControlLinkHeapIdDto;
  SupportedIntents?: ControlLinkIntentsDto;
}
