# Chat Not Found on custom API hosts — TDD evidence

Source plan: none. Journeys from the live chat 404 (`Not Found` for t-test and “clean my data”).

## User journeys

- As an analyst, I want chat t-test / data-prep asks to hit `/api/assistant/agent-loop/stream`, not API Gateway `/assistant/...`.
- As an analyst, I want a routing 404 to say the assistant could not be reached, not the raw string `Not Found`.
- As an analyst, a missing dataset must still say `Dataset not found`.

## Task report

| Task                            | Command                                                                                                            | RED                                                                                                     | GREEN                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Custom host is remote           | `pnpm exec jest --forceExit --watchman=false src/lib/tensr-api-url.test.ts src/lib/tensr-proxy-target-url.test.ts` | `isRemoteTensrApi(https://api.tensr.example)` was false; URL was `.../assistant/agent-loop/stream`      | **20 passed** with api-error tests |
| Chat must not print `Not Found` | `pnpm exec jest --forceExit --watchman=false src/lib/api-error.test.ts`                                            | `formatApiErrorMessage` returned `not found` for `{"message":"Not Found"}` and `{"detail":"Not Found"}` | same                               |

## Test specification

| #   | What is guaranteed                                                         | Test                                                             | Type | Result | Evidence           |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---- | ------ | ------------------ |
| 1   | Custom HTTPS API hosts are remote                                          | `tensr-api-url.test.ts` treats a custom HTTPS API host as remote | unit | PASS   | jest command above |
| 2   | Browser chat uses `/api/tensr/assistant/agent-loop/stream` on custom hosts | `tensrApiUrl` custom host case                                   | unit | PASS   | jest               |
| 3   | Local uvicorn stays on `/assistant`                                        | localhost case                                                   | unit | PASS   | jest               |
| 4   | Next proxy prefixes `/api` on custom hosts                                 | `tensr-proxy-target-url.test.ts`                                 | unit | PASS   | jest               |
| 5   | API Gateway `{"message":"Not Found"}` is not dumped into chat              | `api-error.test.ts`                                              | unit | PASS   | jest               |
| 6   | FastAPI `{"detail":"Not Found"}` is not dumped into chat                   | `api-error.test.ts`                                              | unit | PASS   | jest               |
| 7   | Dataset 404 copy is unchanged                                              | `api-error.test.ts` keeps Dataset not found                      | unit | PASS   | jest               |

## Coverage and known gaps

No Playwright E2E that a logged-in t-test must not render `Not Found`. Lambda route mounts are covered in tensr-api `test_assistant_lambda_mount.py` / `test_lazy_analysis_mount.py`.

## Merge evidence

- RED: 5 failing jest cases (custom host + two 404 formatters).
- GREEN: `isRemoteTensrApi` is any non-localhost http(s) host; generic HTTP 404 maps to a refresh sentence.
