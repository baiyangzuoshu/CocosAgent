/** Provider-reported counts only. Null means unavailable, never zero. */
export interface ModelTokenUsage {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    cacheHitTokens: number | null;
    cacheMissTokens: number | null;
    reasoningTokens: number | null;
}

export type ModelRequestPurpose = 'task-understanding' | 'main-loop' | 'summary';
export interface ModelRequestUsage {
    requestId: string;
    provider: string;
    model: string;
    purpose: ModelRequestPurpose;
    summaryKind?: 'context' | 'conversation';
    startedAt: string;
    durationMs: number;
    status: 'completed' | 'failed';
    httpStatus: number | null;
    errorCode?: string;
    usage: ModelTokenUsage | null;
}

export const MODEL_USAGE_FIELDS = [
    'inputTokens', 'outputTokens', 'totalTokens', 'cacheHitTokens', 'cacheMissTokens', 'reasoningTokens',
] as const;

export interface ModelUsageTotals {
    requestCount: number;
    reportedRequestCount: number;
    totals: ModelTokenUsage;
    /** Number of requests with an actual reported value for each total. */
    coverage: Record<keyof ModelTokenUsage, number>;
}

export interface ModelUsageSummary extends ModelUsageTotals {
    byPurpose: Record<ModelRequestPurpose, ModelUsageTotals>;
}

function emptyTotals(): ModelUsageTotals {
    return {
        requestCount: 0, reportedRequestCount: 0,
        totals: { inputTokens: null, outputTokens: null, totalTokens: null,
            cacheHitTokens: null, cacheMissTokens: null, reasoningTokens: null },
        coverage: { inputTokens: 0, outputTokens: 0, totalTokens: 0,
            cacheHitTokens: 0, cacheMissTokens: 0, reasoningTokens: 0 },
    };
}

export function summarizeModelUsage(requests: readonly ModelRequestUsage[]): ModelUsageSummary {
    const result: ModelUsageSummary = { ...emptyTotals(), byPurpose: {
        'task-understanding': emptyTotals(), 'main-loop': emptyTotals(), summary: emptyTotals(),
    } };
    const seen = new Set<string>();
    for (const request of requests) {
        if (seen.has(request.requestId)) continue;
        seen.add(request.requestId);
        for (const group of [result, result.byPurpose[request.purpose]]) {
            group.requestCount += 1;
            if (request.usage && MODEL_USAGE_FIELDS.some((key) => request.usage![key] !== null)) group.reportedRequestCount += 1;
            for (const key of MODEL_USAGE_FIELDS) {
                const count = request.usage?.[key];
                if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) continue;
                group.totals[key] = (group.totals[key] ?? 0) + count;
                group.coverage[key] += 1;
            }
        }
    }
    return result;
}
