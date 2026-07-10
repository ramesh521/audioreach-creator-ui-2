/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {ApiResult} from './api-response.types';

/**
 * Process an API response and convert it to an ApiResult
 * @param response The fetch Response object
 * @returns ApiResult object
 */
export async function processApiResponse<T>(
  response: Response,
): Promise<ApiResult<T>> {
  // Handle HTTP errors
  if (!response.ok) {
    return {
      errors: [`HTTP error: ${response.status}`],
      message: `HTTP error: ${response.status} ${response.statusText}`,
      success: false,
    };
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await response.formData();
      // Deliberate cast: multipart endpoints return FormData, not a JSON DTO.
      // Callers must pass T = FormData when using get<T>() against multipart endpoints.
      return {data: formData as unknown as T, message: '', success: true};
    } catch {
      return {
        errors: ['Invalid multipart response'],
        message: 'Failed to parse multipart response',
        success: false,
      };
    }
  }

  try {
    // Parse the response as JSON
    return await response.json();
  } catch (_error) {
    // Handle JSON parsing errors
    return {
      errors: ['Invalid JSON response'],
      message: 'Failed to parse response as JSON',
      success: false,
    };
  }
}
