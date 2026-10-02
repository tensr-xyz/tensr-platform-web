# Data processing agreement (draft)

This is a draft for counsel to review. It is not a signed agreement and it is not legal advice.

## Parties

The customer is the controller. Tensr is the processor for the survey data, account data, and assistant prompts the customer submits to the Tensr application.

## Subject matter

Hosting survey datasets, running the analyses the customer requests, and sending the assistant the context described in `DATA_TRUST_AND_COMPLIANCE.md`.

## Duration

The agreement lasts while the customer has an account. On account or organisation deletion, Tensr deletes the datasets that account or organisation owns, as described in the trust document. CloudWatch logs expire after 90 days. Noncurrent S3 object versions expire after 30 days.

## Nature and purpose

Storage in Amazon S3 (us-east-1), metadata in DynamoDB (us-east-1), and the subprocessors listed in `DATA_TRUST_AND_COMPLIANCE.md`: AWS, OpenAI, Stytch, Stripe, PostHog (US), and Vercel.

## Instructions

Tensr processes customer data to provide the product the customer is using. Schema-only organisations do not send category levels, value labels, or sample rows to the model. Chat messages are sent as the user typed them. OpenAI requests set `store: false`.

## Security

Datasets are encrypted at rest with SSE-S3 (AES-256). The bucket requires TLS. DynamoDB point-in-time recovery is on. Tensr does not claim SOC 2, SCIM, or SAML.

## Subprocessors

The customer authorises the subprocessors named in `DATA_TRUST_AND_COMPLIANCE.md`. Tensr will update that list when a subprocessor changes.

## Deletion and return

The customer can delete a dataset, an organisation, or their account from the product. Tensr does not offer a separate export-on-exit beyond the dataset downloads already in the product (CSV, Excel, SPSS, Stata).

## International transfers

AWS processing for the current environments is in us-east-1. Other subprocessors process data in the regions stated in the trust document.
