---
name: tensr-aws-debug
description: Debug tensr-api Lambdas with the CDK names, accounts, and default CloudWatch log groups. Use when a deployed route fails or a cold start looks wrong.
---

# Tensr AWS debug

Use this when the failure is in a deployed Lambda, not in pytest. Pasting AWS keys into chat is allowed. Do not commit them. `phc_` and `public-token-` are public.

## Accounts and region

From `tensr-api/infra/app.py` and `infra/DEPLOY.md`:

- Region `us-east-1`.
- Dev account `970547354308` (`-c stage=dev`).
- Prod account `124355681916` (`-c stage=prod`).
- Infra account `207567773071` holds the GitHub OIDC roles `tensr-github-cdk-deploy-dev` and `tensr-github-cdk-deploy-prod`. The agent should use a profile in the dev or prod account, not the infra account, to read logs.

Stacks are named `{stage}-{Name}` in `compose_stacks` (`infra/stacks/compose.py`): `DataStack`, `OpsStack`, `ApiStack`, `NetworkingStack`, `RealtimeStack`, `AuthStack`, `BillingStack`, `DatasetsStack`, `AssistantStack`, `PluginsStack`, `McpStack`.

## Lambda names

`function_name=f"{stage_name}-tensr-..."` in the stacks:

- `{stage}-tensr-datasets` — Docker image `Dockerfile.datasets`, timeout 29s, memory 3008. Analyze routes mount on first `/analyze/` request (`LazyAnalysisMiddleware` in `app/lambda_handlers/datasets.py`) so list/upload cold starts stay lighter. Same image, no API route: `{stage}-tensr-datasets-mcp` (180s) for async MCP runs.
- `{stage}-tensr-assistant` — `AssistantStack`. Chat and tool loop. It invokes the datasets function for Approve / Agent runs (`datasets_stack.py` comment).
- `{stage}-tensr-auth` — zip Lambda. Serves the home dataset list so that path avoids the Docker datasets cold start (`app/lambda_handlers/auth.py`).
- `{stage}-tensr-billing`, `{stage}-tensr-plugins-api`, `{stage}-tensr-plugins-executor`, `{stage}-tensr-realtime-connect-img`, `disconnect-img`, `message-img`, `{stage}-tensr-mcp`.

HTTP API name is `{stage}-api` (`ApiStack`). CDK does not set a custom log group. Lambda's default group is `/aws/lambda/{function-name}`.

Provisioned concurrency defaults to 0 (`provisioned_concurrency_for` in `infra/stacks/lambda_utils.py`). The comment there: many accounts cannot reserve any without a quota increase, because the unreserved minimum is 10. Datasets opts in with `-c provisionedConcurrency=N`; a prod default of 1 can be rejected when fewer than 10 unreserved executions would remain (`datasets_stack.py`). There is no checked-in cold-start millisecond number. Do not invent one. The split that matters: auth zip answers `GET /api/datasets` (the list); datasets Docker answers `/api/datasets/{proxy+}` including analyze.

## Debug

Use the environment profile. Do not write keys into the repo.

```bash
export AWS_PROFILE=tensr-dev
export AWS_REGION=us-east-1
aws sts get-caller-identity
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/dev-tensr-datasets
aws logs tail /aws/lambda/dev-tensr-assistant --since 30m
aws lambda get-function-configuration --function-name dev-tensr-datasets
```

Swap `dev` for `prod` only with the prod profile. Assistant errors that are actually analyze failures show up on the datasets log group, because the assistant invokes datasets.

## Pitfall

A 404 on `/analyze/...` after a cold start can be the lazy mount (`_mount_heavy_analysis_routes`) or an `analysis_type` that is not a real route (`regression` vs `linear_regression`). Check the datasets log before changing API Gateway.
