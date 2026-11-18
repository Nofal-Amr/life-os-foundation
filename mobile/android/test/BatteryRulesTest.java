package app.lifeos;

/** The SIM phone's battery: what gets sent, and one low alert per threshold per discharge. */
public class BatteryRulesTest {
    private static void check(boolean condition, String what) {
        if (!condition) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        int none = BatteryRules.NONE;

        check(BatteryRules.worthSending(-1, false, 64, false), "first reading is sent");
        check(!BatteryRules.worthSending(64, false, 64, false), "same reading isn't sent again");
        check(BatteryRules.worthSending(64, false, 63, false), "a new percentage is sent");
        check(BatteryRules.worthSending(63, false, 63, true), "plugging in is sent");
        check(!BatteryRules.worthSending(63, false, 140, false), "nonsense level isn't sent");

        check(BatteryRules.alertFor(21, false, none) == 0, "no alert above 20%");
        check(BatteryRules.alertFor(20, false, none) == 20, "alert at 20%");
        check(BatteryRules.alertFor(19, false, 20) == 0, "20% alert only once");
        check(BatteryRules.alertFor(10, false, 20) == 10, "alert again at 10%");
        check(BatteryRules.alertFor(9, false, 10) == 0, "10% alert only once");
        check(BatteryRules.alertFor(8, false, none) == 10, "jumping below 10% gives the 10% alert");
        check(BatteryRules.alertFor(15, true, none) == 0, "no alert while charging");

        check(BatteryRules.nextLastAlerted(20, false, none) == 20, "remembers the 20% alert");
        check(BatteryRules.nextLastAlerted(22, false, 20) == 20, "small rise keeps it");
        check(BatteryRules.nextLastAlerted(30, false, 20) == none, "back above 25% re-arms");
        check(BatteryRules.nextLastAlerted(15, true, 10) == none, "charging re-arms");
        System.out.println("BatteryRules: all passed");
    }
}
