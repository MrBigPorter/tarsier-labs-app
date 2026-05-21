# Android Google Play — Content Rating & Data Safety Answers

**App**: Tarsier (`com.tarsier.labs`)
**Date**: May 2026
**Contact Email**: mrporterdev@gmail.com
**Privacy Policy URL**: https://blog.joyminis.com/en/privacy
**Account Deletion URL**: https://blog.joyminis.com/en/privacy (instructions on privacy page)

---

## Phase 1: IARC Content Rating Questionnaire

### Section 1: Violence

- **Q1**: Does your app contain, reference, or describe any depictions of violence? **No**

### Section 2: Sexual Content

- **Q1**: Does your app contain, reference, or describe sexual content? **No**
- **Q2**: Nudes or nudity? **No**
- **Q3**: Sexual intercourse or arousing activities? **No**
- **Q4**: Sexual exploitation? **No**
- **Q5**: Profanity or hate speech? **No**

### Section 3: Controlled Substances

- **Q1**: Tobacco, alcohol, or drugs? **No**

### Section 4: Other

- **Q1**: Gambling? **No**
- **Q2**: Uncontrolled chat functions? **Yes** (comment system with PENDING/APPROVED/REJECTED moderation)
- **Q3**: Sharing of personal information? **No**
- **Q4**: Location sharing? **No**
- **Q5**: Digital purchases? **No**
- **Q6**: Requires a Bluetooth-paired device? **No**

### Final Ratings

| Region            | Rating       |
| ----------------- | ------------ |
| ESRB (USA)        | **Everyone** |
| PEGI (Europe)     | **PEGI 3**   |
| USK (Germany)     | **All ages** |
| ClassInd (Brazil) | **All ages** |
| Global            | **Rated 3+** |

---

## Phase 2: Target Age Group

- ✅ **13–15**
- ✅ **16–17**
- ✅ **18 and over**
- ❌ 9–12 (excluded to avoid COPPA/GDPR-K)

---

## Phase 3: Data Safety Questionnaire

### Step 1: Account Creation & Deletion

**Account Creation Methods**:

- Users can create accounts? **Yes**
- Methods: **Email/passwordless (6-digit code), Google OAuth, Facebook OAuth, Apple OAuth**

**Delete Account URL**: `https://blog.joyminis.com/en/privacy` (Section 4.2 contains deletion instructions)

### Step 2: Data Types (14 Categories)

#### Personal info

| Sub-type      | Collected?   |
| ------------- | ------------ |
| Name          | ✅ Collected |
| Email address | ✅ Collected |
| User IDs      | ✅ Collected |

#### Location

| Sub-type             | Collected?       |
| -------------------- | ---------------- |
| Approximate location | ❌ Not collected |
| Precise location     | ❌ Not collected |

#### Financial info

| Sub-type               | Collected?       |
| ---------------------- | ---------------- |
| Purchase history       | ❌ Not collected |
| Credit/debit card info | ❌ Not collected |
| Other financial info   | ❌ Not collected |

#### Health and fitness

| Sub-type     | Collected?       |
| ------------ | ---------------- |
| Health info  | ❌ Not collected |
| Fitness info | ❌ Not collected |

#### Messages

| Sub-type              | Collected?                                       |
| --------------------- | ------------------------------------------------ |
| Emails, SMS, or MMS   | ❌ Not collected                                 |
| Other in-app messages | ❌ Not collected (comments stored, not messages) |

#### Photos and videos

| Sub-type | Collected?       |
| -------- | ---------------- |
| Photos   | ❌ Not collected |
| Videos   | ❌ Not collected |

#### Audio files

| Sub-type                  | Collected?       |
| ------------------------- | ---------------- |
| Voice or sound recordings | ❌ Not collected |
| Music files               | ❌ Not collected |
| Other audio files         | ❌ Not collected |

#### Files and docs

| Sub-type       | Collected?       |
| -------------- | ---------------- |
| Files and docs | ❌ Not collected |

#### Calendar

| Sub-type        | Collected?       |
| --------------- | ---------------- |
| Calendar events | ❌ Not collected |

#### Contacts

| Sub-type | Collected?       |
| -------- | ---------------- |
| Contacts | ❌ Not collected |

#### App activity

| Sub-type                     | Collected?                                     |
| ---------------------------- | ---------------------------------------------- |
| App interactions             | ✅ Collected (article views, likes, bookmarks) |
| In-app search history        | ✅ Collected                                   |
| Other user-generated content | ✅ Collected (comments)                        |
| Installed apps               | ❌ Not collected                               |

#### Web browsing

| Sub-type             | Collected?       |
| -------------------- | ---------------- |
| Web browsing history | ❌ Not collected |

#### App info and performance

| Sub-type                   | Collected?                                              |
| -------------------------- | ------------------------------------------------------- |
| Crash logs                 | ✅ Collected (via Sentry) — **Shared with third party** |
| Diagnostics                | ✅ Collected                                            |
| Other app performance data | ❌ Not collected                                        |

#### Device or other IDs

| Sub-type            | Collected?                                                       |
| ------------------- | ---------------------------------------------------------------- |
| Device or other IDs | ✅ Collected (via Sentry/Firebase) — **Shared with third party** |

### Step 3: Data Usage and Handling

#### Personal info

**Name**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: Yes (users can't turn off)
- Purpose: App functionality, Account management

**Email address**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: Yes (users can't turn off)
- Purpose: App functionality, Account management

**User IDs**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: Yes (users can't turn off)
- Purpose: App functionality, Account management

#### App activity

**App interactions**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: Yes (users can't turn off)
- Purpose: App functionality

**In-app search history**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: No (users can choose)
- Purpose: App functionality

**Other user-generated content**

- Collected: Yes (not shared)
- Ephemeral: No (stored in database)
- Required: No (users can choose)
- Purpose: App functionality

#### App info and performance

**Crash logs**

- Collected: Yes — **Shared with Sentry** (third party)
- Ephemeral: No (stored on Sentry servers)
- Required: No (users can choose)
- Purpose (Collected): Analytics
- Purpose (Shared): Analytics

**Diagnostics**

- Collected: Yes (not shared)
- Ephemeral: No (stored for analysis)
- Required: No (users can choose)
- Purpose: Analytics

#### Device or other IDs

- Collected: Yes — **Shared with Sentry/Firebase** (third parties)
- Ephemeral: No (stored by third-party services)
- Required: No (users can choose)
- Purpose (Collected): App functionality, Analytics
- Purpose (Shared): App functionality, Analytics

### Step 4: Security & Privacy Policy

- **Data encrypted in transit**: ✅ Yes (TLS 1.3)
- **Privacy Policy URL**: `https://blog.joyminis.com/en/privacy`
- **Data deletion**: Users can delete account/data via Settings or by email request

---

## Summary of Third-Party Data Sharing

| Third Party         | Data Shared                       | Purpose                                  |
| ------------------- | --------------------------------- | ---------------------------------------- |
| Sentry              | Crash logs, Device IDs, App state | Crash reporting & performance monitoring |
| Firebase (Google)   | Device IDs                        | Push notifications                       |
| AWS (CloudFront/S3) | IP address, Requested content     | Content delivery & image hosting         |
