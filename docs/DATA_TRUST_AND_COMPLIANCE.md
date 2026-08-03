# Data Trust & Compliance

Aimed at procurement and security reviewers evaluating Tensr’s data-handling
posture relative to typical enterprise LLM / SaaS analytics products.

> **Scope note (Item 9):** This page documents claims that can be verified
> against current infrastructure configuration. Customer-managed KMS (CMK) is
> **not** implemented in this pass — it is listed below as a documented future
> option when a customer’s procurement process specifically requires it.

## Summary for reviewers

| Topic                               | Current posture                                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encryption in transit               | TLS required for API and browser traffic (`enforce_ssl` on the datasets bucket; HTTPS on API endpoints)                                                                                            |
| Encryption at rest (object storage) | **SSE-S3** — Amazon S3-managed keys (`BucketEncryption.S3_MANAGED`) on the datasets bucket                                                                                                         |
| Encryption at rest (metadata DB)    | DynamoDB server-side encryption (AWS-owned keys) with point-in-time recovery enabled on the business table                                                                                         |
| Customer-managed KMS (CMK)          | **Not enabled today.** Documented future option if procurement requires customer-controlled key material                                                                                           |
| Data residency                      | Deployed in the AWS region configured for the environment (see infra stage); datasets and business records stay in that account/region                                                             |
| Retention                           | Dataset objects follow bucket lifecycle / retention of the stage; incomplete multipart uploads aborted after 7 days. Application-level retention follows product/org deletion flows                |
| LLM / assistant data                | Assistant calls send schema packets / prompts to the configured OpenAI-compatible provider; they are not used to train Tensr models. Provider retention follows the contracted LLM vendor’s policy |
| Access control                      | Dataset load is authorization-scoped (`load_df_authorized`) to the active user / organization                                                                                                      |

## Encryption at rest — accurate claim

Dataset Parquet/objects in the Tensr datasets bucket are encrypted at rest with
**SSE-S3** (S3-managed encryption keys), as configured in
`tensr-api/infra/stacks/data_stack.py`:

```python
encryption=s3.BucketEncryption.S3_MANAGED,
enforce_ssl=True,
```

This is **not** the same as customer-managed KMS (SSE-KMS with a customer CMK).
Do not describe the current stack as “customer-managed KMS” in security
questionnaires.

### Future option: customer-managed KMS

If a customer’s procurement or security questionnaire specifically requires
customer-controlled key material (CMK / SSE-KMS, key policies, rotation under
customer IAM), Tensr can evaluate enabling bucket encryption with a
customer-managed KMS key as a follow-on infrastructure change. That work is
**out of scope for the current agent-loop rebuild** and is not implied by the
SSE-S3 claim above.

## Comparison to common enterprise LLM data-handling expectations

| Expectation                                    | Tensr today                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Encrypt data at rest                           | Yes — SSE-S3 (S3-managed) + DynamoDB SSE                                 |
| Encrypt data in transit                        | Yes — TLS / `enforce_ssl`                                                |
| Isolate tenant data                            | Org/user ownership on datasets; authorized load paths                    |
| No training on customer prompts by the product | Tensr does not train models on customer data                             |
| Bring-your-own-key (BYOK)                      | Not available yet — see KMS future option                                |
| Data processing agreement / DPA                | Provided under commercial agreement (contact sales/legal)                |
| Subprocessors (LLM)                            | Configured OpenAI-compatible provider (e.g. OpenAI / OpenRouter per env) |

## What the agent may send to the LLM

The tool-calling agent loop may include, in prompts to the LLM provider:

- Column names, types, and bounded schema/stats packets
- Short sample rows when `read_data` results are summarized
- User chat messages and recent conversation turns
- Tool call arguments/results (aggregated answers, not full raw exports by default)

It does **not** expose a raw code-execution tool. Analysis and transforms run
through allowlisted, validated engines inside Tensr’s API.

## Contact

For questionnaire completion, DPA requests, or KMS roadmap timing, contact your
Tensr account representative or security@tensr (as published on the company site).
