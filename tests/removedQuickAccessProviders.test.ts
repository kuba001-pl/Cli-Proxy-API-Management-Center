import { describe, expect, test } from 'bun:test';
import { buildProviderGroups } from '../src/features/providers/useProviderWorkbench';
import type { Config } from '../src/types';

const retiredEndpoints = [
  ['code0', 'https://code0.ai'],
  ['lmuAI', 'https://api.lmuai.com'],
  ['infistar', 'https://coneverse.com'],
  ['infistar', 'https://infistar.ai'],
  ['claudeApi', 'https://gw.apito.ai'],
  ['claudeApi', 'https://gw.claudeapi.com'],
  ['fennoAI', 'https://api.fenno.ai'],
  ['qiniuCloud', 'https://api.qnaigc.com'],
  ['qiniuCloud', 'https://api.modelink.ai'],
  ['apikeyFun', 'https://api.apikey.fan'],
  ['apikeyFun', 'https://slb.apikey.fan'],
] as const;

const removedBrands = ['fennoAI', 'qiniuCloud', 'apikeyFun'] as const;

describe('removed quick-access providers', () => {
  test('removes retired brand groups', () => {
    const ids = buildProviderGroups({}).map((group) => group.id);
    for (const [brand] of retiredEndpoints) {
      expect(ids).not.toContain(brand);
    }
    for (const brand of removedBrands) {
      expect(ids).not.toContain(brand);
    }
    for (const brand of ['kimi']) {
      expect(ids).toContain(brand);
    }
  });

  for (const [name, baseUrl] of retiredEndpoints.filter(([brand]) =>
    (removedBrands as readonly string[]).includes(brand)
  )) {
    test(`keeps ${baseUrl} official protocol URLs in generic protocol groups`, () => {
      const versionedUrl = `${baseUrl}/v1`;
      const config: Config = {
        geminiApiKeys: [{ apiKey: 'test-retired-key', baseUrl }],
        codexApiKeys: [{ apiKey: 'test-retired-key', baseUrl: versionedUrl }],
        claudeApiKeys: [{ apiKey: 'test-retired-key', baseUrl }],
        openaiCompatibility: [
          { name, baseUrl: versionedUrl, apiKeyEntries: [{ apiKey: 'test-retired-key' }] },
        ],
      };
      const groups = buildProviderGroups(config);
      for (const brand of ['gemini', 'codex', 'claude', 'openaiCompatibility']) {
        expect(groups.find((group) => group.id === brand)!.resources).toHaveLength(1);
      }
      expect(groups.find((group) => group.id === 'kimi')!.resources).toHaveLength(0);
      expect(groups.flatMap((group) => group.resources)).toHaveLength(4);
    });
  }

  for (const [name, baseUrl] of retiredEndpoints) {
    test(`keeps ${baseUrl} configs editable in generic protocol groups`, () => {
      const key = {
        apiKey: 'test-retired-key',
        baseUrl,
        excludedModels: ['*', 'excluded-model'],
        fingerprintProfile: 'claude-code-cli',
      };
      const openai = {
        name,
        baseUrl: `${baseUrl}/v1`,
        apiKeyEntries: [{ apiKey: 'test-retired-key' }],
        sourceIndex: 7,
        disabled: true,
      };
      const config: Config = {
        geminiApiKeys: [key],
        codexApiKeys: [key],
        claudeApiKeys: [key],
        openaiCompatibility: [openai],
      };
      const groups = buildProviderGroups(config);
      for (const brand of ['gemini', 'codex', 'claude', 'openaiCompatibility']) {
        const resources = groups.find((group) => group.id === brand)!.resources;
        expect(resources).toHaveLength(1);
        const resource = resources[0];
        expect(resource.brand).toBe(brand);
        expect(resource.disabled).toBe(true);
        expect(resource.raw).toBe(brand === 'openaiCompatibility' ? openai : key);
        expect(resource.selector).toEqual(
          brand === 'openaiCompatibility'
            ? { brand, name, index: 7 }
            : { brand, apiKey: key.apiKey, baseUrl, index: 0 }
        );
        if (brand === 'claude') expect(resource.flags.claudeCodeCliProfile).toBe(true);
      }
      expect(groups.flatMap((group) => group.resources)).toHaveLength(4);
    });
  }
});
