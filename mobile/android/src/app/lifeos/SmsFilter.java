package app.lifeos;

import java.util.regex.Pattern;

/**
 * Which SMS Life Connect sends on to the main phone. One-time codes (OTPs,
 * verification and login codes) stay on the SIM phone unless you switch
 * "Include one-time codes" on yourself; it is off by default.
 *
 * Plain Java (no Android classes), so it is tested in mobile/android/test.
 */
final class SmsFilter {
    /** Off unless you turn it on. */
    static final boolean CODES_DEFAULT = false;

    private static final Pattern CODE = Pattern.compile(
        "(?i)\\b(otp|one[- ]?time|verification|passcode|password|code)\\b|رمز|كود|كلمة السر|كلمة المرور|التحقق");

    private SmsFilter() {}

    static boolean looksLikeCode(String body) {
        return body != null && CODE.matcher(body).find();
    }

    static boolean forwards(boolean includeCodes, String body) {
        return includeCodes || !looksLikeCode(body);
    }
}
