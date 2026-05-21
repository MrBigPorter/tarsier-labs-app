# 添加 Production CodePush CI Job

## 分支策略

```
main      → 完整发布（build AAB → Google Play Internal Testing）
hotfix    → 紧急修复（lint → test → CodePush Production），不跑 native build
test      → 日常测试（build APK + CodePush Staging）
```

## 改动清单

### 1. `deploy.yml` — 触发条件

在 `on.push.branches` 中新增 `hotfix`：

```yaml
on:
  push:
    branches:
      - main
      - test
      - hotfix # ← NEW
```

### 2. `deploy.yml` — resolve-flavor

让 `hotfix` 分支也解析为 `production` flavor：

```yaml
elif [[ "${{ github.ref }}" == "refs/heads/hotfix" ]]; then
FLAVOR="production"
```

### 3. `deploy.yml` — 新增 codepush-production job

```yaml
codepush-production:
  name: CodePush Production (Hotfix)
  needs: [resolve-flavor]
  if: ${{ needs.resolve-flavor.outputs.flavor == 'production' && github.ref == 'refs/heads/hotfix' }}
  runs-on: ubuntu-latest
  timeout-minutes: 15
  environment: production

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: 'yarn' }

    - run: yarn install --immutable --ignore-scripts
    - run: npx patch-package

    # Gate
    - run: yarn lint
    - run: yarn test

    # CodePush
    - run: npm install -g code-push-standalone
    - run: |
        code-push-standalone login ${{ secrets.CODEPUSH_SERVER_URL }} \
          --accessKey "${{ secrets.CODEPUSH_ACCESS_KEY }}"
    - run: |
        code-push-standalone release-react Tarsier-android android \
          --deploymentName Production \
          --description "HOTFIX: $(git log -1 --pretty=%s)"
    - run: |
        code-push-standalone release-react Tarsier-ios ios \
          --deploymentName Production \
          --description "HOTFIX: $(git log -1 --pretty=%s)"
```

### 4. `README.md` — 更新表格

| Trigger          | Flavor     | Build Output                    | Auto Deploy                  |
| ---------------- | ---------- | ------------------------------- | ---------------------------- |
| `test`           | Staging    | APK + archive + CodePush        | CodePush to Staging          |
| `hotfix` **NEW** | Production | CodePush only (no native build) | ✅ CodePush to Production    |
| `main`           | Production | Android AAB                     | Google Play Internal Testing |
| Tag `v*`         | Production | Android AAB + iOS archive       | Google Play Internal Testing |
| Manual           | User pick  | Selected build                  | Depends                      |
