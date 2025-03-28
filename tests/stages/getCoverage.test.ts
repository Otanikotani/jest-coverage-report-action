import { sep } from 'path';

import { exec } from '@actions/exec';
import { readFile } from 'fs-extra';
import { mocked } from 'ts-jest/utils';

import { getCoverage } from '../../src/stages/getCoverage';
import { ActionError } from '../../src/typings/ActionError';
import { JsonReport } from '../../src/typings/JsonReport';
import { Options } from '../../src/typings/Options';
import { FailReason } from '../../src/typings/Report';
import { createDataCollector } from '../../src/utils/DataCollector';
import { removeDirectory } from '../../src/utils/removeDirectory';

jest.mock('../../src/utils/removeDirectory');

const defaultOptions: Options = {
    token: '',
    testScript: 'default script',
    iconType: 'emoji',
    annotations: 'all',
    packageManager: 'npm',
    skipStep: 'none',
    prNumber: null,
    pullRequest: null,
    output: ['comment'],
};

const clearMocks = () => {
    mocked(exec).mockClear();
    mocked(readFile).mockClear();
    mocked(removeDirectory).mockClear();
};

beforeEach(clearMocks);

describe('getCoverage', () => {
    it('should skip all steps', async () => {
        const dataCollector = createDataCollector<JsonReport>();

        (readFile as jest.Mock<any, any>).mockImplementationOnce(() => '{}');

        const jsonReport = await getCoverage(
            dataCollector,
            { ...defaultOptions, skipStep: 'all' },
            undefined
        );

        expect(removeDirectory).not.toBeCalledWith('node_modules');
        expect(exec).not.toBeCalledWith('npm install', undefined, {
            cwd: undefined,
        });
        expect(exec).not.toBeCalledWith(
            'default script --ci --json --coverage --testLocationInResults --outputFile="report.json"',
            [],
            {
                cwd: undefined,
            }
        );
        expect(readFile).toHaveBeenCalledWith('report.json');

        expect(jsonReport).toStrictEqual({});
    });

    it('should throw error if report file not found', async () => {
        const dataCollector = createDataCollector<JsonReport>();

        (readFile as jest.Mock<any, any>).mockImplementationOnce(
            () => undefined
        );

        await expect(
            getCoverage(
                dataCollector,
                { ...defaultOptions, skipStep: 'all' },
                undefined
            )
        ).rejects.toBeDefined();
    });

    it('should read coverage from specified coverage file', async () => {
        const dataCollector = createDataCollector<JsonReport>();

        (readFile as jest.Mock<any, any>).mockImplementationOnce(() => '{}');

        const jsonReport = await getCoverage(
            dataCollector,
            defaultOptions,
            'custom filepath'
        );

        expect(removeDirectory).not.toBeCalled();
        expect(exec).not.toBeCalled();
        expect(readFile).toBeCalledWith('custom filepath');
        expect(readFile).toBeCalledTimes(1);

        expect(jsonReport).toStrictEqual({});
    });

    it('should return error, if reading from specified coverage file failed', async () => {
        const dataCollector = createDataCollector<JsonReport>();

        (readFile as jest.Mock<any, any>).mockImplementationOnce(() => {
            throw new Error('a');
        });

        await expect(
            getCoverage(dataCollector, defaultOptions, 'custom filepath')
        ).rejects.toStrictEqual(
            new ActionError(FailReason.FAILED_GETTING_COVERAGE)
        );

        expect(removeDirectory).not.toBeCalled();
        expect(exec).not.toBeCalled();
        expect(readFile).toBeCalledWith('custom filepath');
        expect(readFile).toBeCalledTimes(1);
        expect(dataCollector.get().errors).toStrictEqual([
            new ActionError(FailReason.READING_COVERAGE_FILE_FAILED, {
                error: new Error('a').toString(),
            }),
        ]);
    });
});
