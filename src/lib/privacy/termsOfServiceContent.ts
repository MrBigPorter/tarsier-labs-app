/**
 * Terms of Service content in all supported languages.
 * Follows the same pattern as privacyContent.ts.
 *
 * Apple Guideline 1.2 requires a EULA/Terms of Service to be presented
 * to users before they register or log in.
 */

export const TOS_CONTENT: Record<string, string> = {
  en: `# Terms of Service

**Last updated: June 2026**

## 1. Acceptance of Terms

By accessing or using the Tarsier Blog application ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.

## 2. User Accounts

### 2.1 Registration
To access certain features (such as commenting and bookmarking), you must register for an account. You agree to provide accurate and complete information during registration.

### 2.2 Account Security
You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.

## 3. User-Generated Content

### 3.1 Comments
Users may post comments on articles. By posting a comment, you grant Tarsier Blog a non-exclusive, royalty-free license to display your content.

### 3.2 Prohibited Content
You agree not to post content that:
- Is unlawful, harassing, defamatory, obscene, or otherwise objectionable
- Contains spam, malware, or unauthorized advertisements
- Infringes on the intellectual property rights of others
- Contains hate speech or promotes violence

### 3.3 Content Moderation
We reserve the right to review, moderate, and remove user-generated content. We respond to content reports within 24 hours.

## 4. User Conduct

### 4.1 Reporting
Report objectionable content using the "Report" button on each comment. All reports are reviewed within 24 hours.

### 4.2 Blocking
Block users using the "Block User" button. Blocked content is immediately hidden from your view.

## 5. Intellectual Property

Original content (articles, graphics, logos) is the property of Tarsier Blog or its creators, protected by copyright law.

## 6. Privacy

Your use of the App is governed by our Privacy Policy.

## 7. Limitation of Liability

The App is provided "as is" without warranties. Tarsier Blog is not liable for damages from your use of the App.

## 8. Changes to Terms

We may update these terms. Material changes are notified via in-app notification.

## 9. Termination

We may terminate accounts that violate these terms.

## 10. Contact

**Email:** mrporterdev@gmail.com

---

*By using Tarsier Blog, you acknowledge that you have read and agree to these Terms of Service.*`,

  zh: `# 服务条款

**最后更新：2026年6月**

## 1. 条款接受

使用 Tarsier Blog 应用即表示您同意受本服务条款的约束。如果您不同意这些条款，请勿使用本应用。

## 2. 用户账户

要使用评论和书签等功能，您需要注册账户。您同意在注册时提供准确和完整的信息。

## 3. 用户生成内容

### 3.1 评论
用户可以在文章上发表评论。发布评论即表示您授予 Tarsier Blog 在平台上展示您的内容的许可。

### 3.2 禁止内容
您同意不发布非法、骚扰、诽谤、淫秽、垃圾信息、侵犯知识产权或包含仇恨言论的内容。

### 3.3 内容审核
我们保留审核、管理和删除用户生成内容的权利。我们将在24小时内回应举报。

## 4. 用户行为

### 4.1 举报
使用每条评论上的"举报"按钮进行举报。我们将在24小时内审核。

### 4.2 拉黑
使用"拉黑用户"按钮拉黑用户。被拉黑用户的内容将立即隐藏。

## 5. 知识产权

原创内容归 Tarsier Blog 或其创作者所有，受版权法保护。

## 6. 隐私

使用本应用受我们的隐私政策约束。

## 7. 责任限制

本应用按"现状"提供，不作任何形式的保证。

## 8. 条款变更

条款可能更新，重大变更将通过应用内通知告知。

## 9. 终止

我们保留因违反条款而终止账户的权利。

## 10. 联系方式

**电子邮件：** mrporterdev@gmail.com

---

*使用 Tarsier Blog 即表示您已阅读并同意本服务条款。*`,
};

/**
 * Returns the Terms of Service markdown content for the given locale.
 * Falls back to English for unsupported locales.
 */
export function getTosContent(locale: string): string {
  const lang = locale.split('-')[0];
  return TOS_CONTENT[lang] ?? TOS_CONTENT.en;
}
