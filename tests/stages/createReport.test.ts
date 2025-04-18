import * as all from '@actions/github';

import { createReport, getSha } from '../../src/stages/createReport';
import { JsonReport } from '../../src/typings/JsonReport';
import { Options } from '../../src/typings/Options';
import { createDataCollector } from '../../src/utils/DataCollector';
import report from '../mock-data/jsonReport.json';

const { mockContext, clearContextMock } = all as any;

const DEFAULT_OPTIONS: Options = {
    token: '',
    testScript: '',
    iconType: 'emoji',
    annotations: 'all',
    packageManager: 'npm',
    skipStep: 'all',
    prNumber: 5,
    pullRequest: {
        number: 5,
        head: {
            sha: '123456',
            ref: '123',
            repo: { clone_url: 'https://github.com/test/repo.git' },
        },
        base: {
            sha: '256',
            ref: '456',
            repo: { clone_url: 'https://github.com/test/repo.git' },
        },
    },
    output: ['comment'],
};

describe('createReport', () => {
    it('should extract commit shasum from context', async () => {
        mockContext({ payload: { after: '123456' } });
        expect(getSha()).toBe('123456');
        clearContextMock();

        mockContext({ payload: { pull_request: { head: { sha: '123456' } } } });
        expect(getSha()).toBe('123456');
        clearContextMock();

        mockContext({ payload: {}, sha: '123456' });
        expect(getSha()).toBe('123456');
        clearContextMock();
    });
});
