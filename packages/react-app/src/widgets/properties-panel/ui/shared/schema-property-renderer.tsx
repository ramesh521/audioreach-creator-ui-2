/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {PropertyDto} from '~shared/lib/property.dto';

interface SchemaPropertyRendererProps {
  isEditing: boolean;
  onPropertyChange: (
    propertyId: number,
    elementName: string,
    value: string,
  ) => void;
  properties: PropertyDto[];
}

// TODO: Replace placeholder with generic tree view component.
export function SchemaPropertyRenderer(_props: SchemaPropertyRendererProps) {
  return (
    <div
      className="py-2 text-sm"
      style={{color: 'var(--color-text-neutral-secondary)'}}
    >
      Properties tree view — not yet implemented.
    </div>
  );
}
