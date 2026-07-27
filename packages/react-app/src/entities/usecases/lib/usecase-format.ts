/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ConvertNumberToHexString} from '~shared/utils/converter-utils';

import type {KeyValueInfo} from '../model/usecase.dto';

/** Structural type — accepts any object that has keyValueCollection. */
interface WithKeyValueCollection {
  keyValueCollection: KeyValueInfo[];
}

/** BT_Rx • SCO */
export const formatUsecaseDisplay = (item: WithKeyValueCollection): string =>
  item.keyValueCollection.map((kv) => kv.valueInfo.valueLabel).join(' • ');

/** BT_Rx+SCO */
export const formatAsSearchKey = (item: WithKeyValueCollection): string =>
  item.keyValueCollection.map((kv) => kv.valueInfo.valueLabel).join('+');

/** [DeviceRX: BT_Rx] [BtProfile: SCO] */
export const formatAsKeysValues = (item: WithKeyValueCollection): string =>
  item.keyValueCollection
    .map((kv) => `[${kv.keyInfo.keyLabel}: ${kv.valueInfo.valueLabel}]`)
    .join(' ');

/** [DeviceRX(0xA2000000): BT_Rx(0xA2000003)] [BtProfile(0xB4000000): SCO(0xB4000001)] */
export const formatAsKeysValuesWithIds = (
  item: WithKeyValueCollection,
): string =>
  item.keyValueCollection
    .map(
      (kv) =>
        `[${kv.keyInfo.keyLabel}(${ConvertNumberToHexString(kv.keyInfo.keyId)}): ${kv.valueInfo.valueLabel}(${ConvertNumberToHexString(kv.valueInfo.valueId)})]`,
    )
    .join(' ');
