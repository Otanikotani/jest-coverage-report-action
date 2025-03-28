import { setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';

import { generateCommitReport } from './report/generateCommitReport';
import { generatePRReport } from './report/generatePRReport';
import { checkThreshold } from './stages/checkThreshold';
import { createReport } from './stages/createReport';
import { getCoverage } from './stages/getCoverage';
import { JsonReport } from './typings/JsonReport';
import { getOptions } from './typings/Options';
import { createDataCollector, DataCollector } from './utils/DataCollector';
import { getNormalThreshold } from './utils/getNormalThreshold';
import { i18n } from './utils/i18n';
import { runStage } from './utils/runStage';

export const run = async (
    dataCollector = createDataCollector<JsonReport>()
) => {
    const [isInitialized, options] = await runStage(
        'initialize',
        dataCollector,
        getOptions
    );
    const isInPR = !!options?.pullRequest;

    if (!isInitialized || !options) {
        throw Error('Initialization failed.');
    }

    const [isThresholdParsed, threshold] = await runStage(
        'parseThreshold',
        dataCollector,
        () => {
            return getNormalThreshold(
                options.workingDirectory ?? process.cwd(),
                options.threshold
            );
        }
    );

    const [, baseCoverage] = await runStage(
        'baseCoverage',
        dataCollector,
        async (skip) => {
            if (!options.baseCoverageFile) {
                skip();
            }

            return await getCoverage(
                dataCollector,
                options,
                options.baseCoverageFile
            );
        }
    );

    if (baseCoverage) {
        dataCollector.add(baseCoverage);
    }

    const [, headCoverage] = await runStage(
        'headCoverage',
        dataCollector,
        async (skip) => {
            if (isInPR && !options.coverageFile) {
                skip();
            }

            return await getCoverage(
                dataCollector,
                options,
                options.coverageFile
            );
        }
    );

    if (headCoverage) {
        dataCollector.add(headCoverage);
    }

    console.log('Coverages done!');

    const [, thresholdResults] = await runStage(
        'checkThreshold',
        dataCollector,
        async (skip) => {
            if (!isThresholdParsed) {
                skip();
            }

            return checkThreshold(
                headCoverage!,
                threshold!,
                options.workingDirectory,
                dataCollector as DataCollector<unknown>
            );
        }
    );

    // const [isRunReportGenerated, runReport] = await runStage(
    //     'generateRunReport',
    //     dataCollector,
    //     (skip) => {
    //         if (!isHeadCoverageGenerated) {
    //             skip();
    //         }
    //
    //         return createRunReport(headCoverage!);
    //     }
    // );
    //
    // await runStage('failedTestsAnnotations', dataCollector, async (skip) => {
    //     if (
    //         !isHeadCoverageGenerated ||
    //         !isRunReportGenerated ||
    //         !['all', 'failed-tests'].includes(options.annotations)
    //     ) {
    //         skip();
    //     }
    //
    //     const failedAnnotations = createFailedTestsAnnotations(headCoverage!);
    //
    //     const octokit = getOctokit(options.token);
    //     await upsertCheck(
    //         octokit,
    //         formatFailedTestsAnnotations(runReport!, failedAnnotations, options)
    //     );
    // });

    // await runStage('coverageAnnotations', dataCollector, async (skip) => {
    //     if (
    //         !isHeadCoverageGenerated ||
    //         !['all', 'coverage'].includes(options.annotations)
    //     ) {
    //         skip();
    //     }
    //
    //     let coverageAnnotations = createCoverageAnnotations(headCoverage!);
    //
    //     if (coverageAnnotations.length === 0) {
    //         skip();
    //     }
    //
    //     const octokit = getOctokit(options.token);
    //     if (options.pullRequest?.number) {
    //         const patch = await getPrPatch(octokit, options);
    //         coverageAnnotations = onlyChanged(coverageAnnotations, patch);
    //     }
    //     await upsertCheck(
    //         octokit,
    //         formatCoverageAnnotations(coverageAnnotations, options)
    //     );
    // });

    const [isReportContentGenerated, summaryReport] = await runStage(
        'generateReportContent',
        dataCollector,
        async () => {
            return createReport(dataCollector, options, thresholdResults ?? []);
        }
    );

    await runStage('publishReport', dataCollector, async (skip) => {
        if (!isReportContentGenerated || !options.output.includes('comment')) {
            skip();
        }

        const octokit = getOctokit(options.token);

        if (isInPR) {
            await generatePRReport(
                summaryReport!.text,
                options,
                context.repo,
                options.pullRequest as { number: number },
                octokit
            );
        } else {
            await generateCommitReport(
                summaryReport!.text,
                context.repo,
                octokit
            );
        }
    });

    await runStage('setOutputs', dataCollector, (skip) => {
        if (
            !isReportContentGenerated ||
            !options.output.includes('report-markdown')
        ) {
            skip();
        }

        if (options.output.includes('report-markdown')) {
            setOutput('report', summaryReport!.text);
        }
    });

    console.log('Done!');

    if (dataCollector.get().errors.length > 0) {
        setFailed(i18n('failed'));
    }
};
