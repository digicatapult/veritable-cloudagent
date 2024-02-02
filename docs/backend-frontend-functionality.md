# VER-194 - determine backend functionality needed

## As a User I'd like to sign up to NICE network

| Screen                  | Frontend action     |                          Backend Effect                           |                                Payload |    Note |
| :---------------------- | :------------------ | :---------------------------------------------------------------: | -------------------------------------: | ------: |
| Homescreen_Click_Signup | Click Signup Button |                                 -                                 |                                      - |         |
| Signup_Onboarding1      | Fill out fields     |                                 -                                 |                                      - |         |
| Signup_Onboarding2      | Click Submit Button | POST -> /save-signup-information & trigger sending invitation out | {companyName, companiesHouseNo, email} | MISSING |
| Signup_Onboarding3      | Back to homepage    |                                 -                                 |                                      - |         |

---

## As a User I'd like to complete my sign up

| Screen                         | Frontend action               |       Backend Effect       |                  Payload |
| :----------------------------- | :---------------------------- | :------------------------: | -----------------------: |
| Homescreen_Click_Onboarding    | Click Complete Onboarding Btn |             -              |                        - |
| CompleteOnboarding_scanQRCode1 | Scan QR code & Submit Btn     | POST -> /accept-invitation | {cryptographic material} |
| CompleteOnboarding_Complete    | Back to homepage              |             -              |                        - |

---

## As a user I'd like to see my Verifiable Claims

| Screen                      | Frontend action          |   Backend Effect    |                          Payload |                 Note |
| :-------------------------- | :----------------------- | :-----------------: | -------------------------------: | -------------------: |
| Homescreen_Click_SSIProfile | Click SSI Profile Button |          -          |                                - |                      |
| TBC/view profile            | Upon load                | GET -> /credentials | {verifiable claims registered[]} | gets all credentials |
|                             |                          |   GET -> /profile   |           {Profile information } |              MISSING |
