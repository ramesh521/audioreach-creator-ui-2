/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {type ApiResult, httpClient} from '~shared/api';
import type {ControlLinkPropertiesDto} from '~shared/lib/property.dto';

/**
 * Fetch intents and heap property for a control link.
 * Returns ApiResult<ControlLinkPropertiesDto> and does not throw; callers should
 * inspect result.success.
 */
export async function fetchControlLinkProperties(
  projectId: string,
  linkId: string,
): Promise<ApiResult<ControlLinkPropertiesDto>> {
  return httpClient.get<ControlLinkPropertiesDto>(
    `/projects/${projectId}/control-links/${linkId}/properties`,
  );
}
