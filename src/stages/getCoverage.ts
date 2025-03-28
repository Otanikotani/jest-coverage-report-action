import { collectCoverage } from './collectCoverage';
import { parseCoverage } from './parseCoverage';
import { ActionError } from '../typings/ActionError';
import { JsonReport } from '../typings/JsonReport';
import { Options } from '../typings/Options';
import { FailReason } from '../typings/Report';
import { DataCollector } from '../utils/DataCollector';
import { runStage } from '../utils/runStage';

export const getCoverage = async (
    dataCollector: DataCollector<JsonReport>,
    options: Options,
    coverageFilePath: string | undefined
): Promise<JsonReport> => {
    const [isCoverageCollected, rawCoverage] = await runStage(
        'collectCoverage',
        dataCollector,
        () =>
            collectCoverage(
                dataCollector as DataCollector<unknown>,
                options.workingDirectory,
                coverageFilePath
            )
    );

    const [coverageParsed, jsonReport] = await runStage(
        'parseCoverage',
        dataCollector,
        async (skip) => {
            if (!isCoverageCollected) {
                skip();
            }

            const jsonReport = parseCoverage(rawCoverage!);

            return jsonReport;
        }
    );

    if (!coverageParsed || !jsonReport) {
        throw new ActionError(FailReason.FAILED_GETTING_COVERAGE);
    }

    return jsonReport;
};
