package app.lifeos;

/** One-time codes stay on the SIM phone unless you chose to forward them. */
public class SmsFilterTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        check(!SmsFilter.CODES_DEFAULT, "codes are off by default");
        check(!SmsFilter.forwards(SmsFilter.CODES_DEFAULT, "Your OTP is 482913"), "OTP kept by default");
        check(!SmsFilter.forwards(false, "Your verification code: 1234"), "verification code kept");
        check(!SmsFilter.forwards(false, "رمز التحقق الخاص بك 5521"), "Arabic code kept");
        check(SmsFilter.forwards(false, "See you at 7 at the cafe"), "ordinary SMS forwarded");
        check(SmsFilter.forwards(true, "Your OTP is 482913"), "forwarded when you turned codes on");
        check(SmsFilter.forwards(false, null), "empty SMS forwarded");
        System.out.println("SmsFilter: all passed");
    }
}
