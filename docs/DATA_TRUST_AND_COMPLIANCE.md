# Data Trust & Compliance

Aimed at procurement and security reviewers evaluating Tensr’s data-handling
posture relative to typical enterprise LLM / SaaS analytics products.

> **Scope note (Item 9):** This page documents claims that can be verified
> against current infrastructure configuration. Customer-managed KMS (CMK) is
> **not** implemented in this pass — it is listed below as a documented future
> option when a customer’s procurement process specifically requires it.

## Summary for reviewers

| Topic                               | Current posture                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encryption in transit               | TLS required for API and browser traffic (`enforce_ssl` on the datasets bucket; HTTPS on API endpoints)                                                                                                                     |
| Encryption at rest (object storage) | **SSE-S3** — Amazon S3-managed keys (`BucketEncryption.S3_MANAGED`) on the datasets bucket                                                                                                                                  |
| Encryption at rest (metadata DB)    | DynamoDB server-side encryption (AWS-owned keys) with point-in-time recovery enabled on the business table                                                                                                                  |
| Customer-managed KMS (CMK)          | **Not enabled today.** Documented future option if procurement requires customer-controlled key material                                                                                                                    |
| Data residency                      | AWS us-east-1 for the current dev and production accounts. Datasets, exports, and the business table stay in that region.                                                                                                   |
| Retention                           | CloudWatch logs expire after 90 days. Noncurrent S3 versions expire after 30 days. Incomplete multipart uploads abort after 7 days. DynamoDB items that carry a `ttl` attribute expire on that clock.                       |
| LLM / assistant data                | Schema-only organisations send column names, types, and summary numbers. Category levels, value labels, and sample rows stay out of the model payload. Chat messages are sent as typed. OpenAI requests set `store: false`. |
| Access control                      | Dataset load is authorization-scoped (`load_df_authorized`) to the active user / organization                                                                                                                               |

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

| Expectation                                    | Tensr today                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Encrypt data at rest                           | Yes — SSE-S3 (S3-managed) + DynamoDB SSE                               |
| Encrypt data in transit                        | Yes — TLS / `enforce_ssl`                                              |
| Isolate tenant data                            | Org/user ownership on datasets; authorized load paths                  |
| No training on customer prompts by the product | Tensr does not train models on customer data                           |
| Bring-your-own-key (BYOK)                      | Not available yet — see KMS future option                              |
| Data processing agreement / DPA                | Draft for counsel review: `docs/DPA_DRAFT.md`. Not a signed agreement. |
| Subprocessors                                  | Listed below. Region for AWS processing is us-east-1.                  |

## Subprocessors

| Subprocessor        | Role                                                | Region                                           |
| ------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Amazon Web Services | Dataset storage, API compute, database, logs        | us-east-1                                        |
| OpenAI              | Assistant model calls. Requests set `store: false`. | OpenAI's processing region under their API terms |
| Stytch              | Email one-time-code sign-in                         | Stytch's processing region                       |
| Stripe              | Subscription billing                                | Stripe's processing region                       |
| PostHog             | Product analytics for the app                       | PostHog US project                               |
| Vercel              | Web app hosting                                     | Vercel project region                            |

## Deletion

Deleting a dataset also deletes datasets derived from it, incoming upload objects, stored exports made from that dataset (each export's file and metadata, and its row in every user's export list), collaboration sessions owned by the dataset owner, report comments on that dataset's reports, and every stored version of those S3 objects. If any S3 delete fails, the dataset is kept and the request returns an error. Exports created before 4 October 2026 are found through the export lists of the dataset's creator, its owner, or its organisation's current members.

`DELETE /organizations/{id}` and `DELETE /me` do not delete S3 from the auth Lambda. That Lambda records a purge job (no `ttl`) and queues it. The datasets worker deletes every S3 version for the dataset parquet, metadata, incoming upload, stored exports, and, for an account deletion, that user's notebook-run cache. The job status is `pending`, `running`, `succeeded`, or `failed`. A failed job stays in DynamoDB and the queue retries it, then moves the message to a dead-letter queue. Personal organisations cannot be deleted with `DELETE /organizations/{id}`.

`DELETE /me` removes the signed-in user's own datasets, organisation memberships, and user record. It does not delete datasets owned by an organisation.

Both deletes cancel a live Stripe subscription first: the organisation's for `DELETE /organizations/{id}`, the user's own for `DELETE /me`. The cancel is immediate. If Stripe is not configured or the cancel fails, the request returns 409 and nothing is deleted. Manual comps have no Stripe subscription and are cancelled locally. After `DELETE /me` the user's subscription record is kept, marked cancelled.

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
