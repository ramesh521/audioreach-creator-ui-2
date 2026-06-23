/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {type ApiResult, httpClient} from '~shared/api';
import type {PropertyDto} from '~shared/lib/property.dto';

/**
 * Fetch the self-describing property list for a subgraph instance.
 * Returns ApiResult<PropertyDto[]> and does not throw; callers should inspect
 * result.success.
 */
export async function fetchSubgraphProperties(
  projectId: string,
  subgraphId: string,
): Promise<ApiResult<PropertyDto[]>> {
  return httpClient.get<PropertyDto[]>(
    `/projects/${projectId}/subgraphs/${subgraphId}/properties`,
  );
}
