const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const sources = (pkg) => ({
  'GoalStore.kt': `package ${pkg}

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray

data class Goal(val wish: String, val plan: String)

object GoalStore {
    fun load(ctx: Context): List<Goal> {
        val out = ArrayList<Goal>()
        try {
            val path = ctx.getDatabasePath("RKStorage").absolutePath
            val db = SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READONLY)
            val c = db.rawQuery("SELECT value FROM catalystLocalStorage WHERE key = ?", arrayOf("woop_goals_v1"))
            if (c.moveToFirst()) {
                val arr = JSONArray(c.getString(0))
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    out.add(Goal(o.optString("wish"), o.optString("plan")))
                }
            }
            c.close()
            db.close()
        } catch (e: Exception) {
        }
        return out
    }

    fun random(ctx: Context): Goal? {
        val all = load(ctx)
        return if (all.isEmpty()) null else all.random()
    }
}
`,

  'GoalWidgetProvider.kt': `package ${pkg}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class GoalWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(context)
    }

    companion object {
        const val ACTION_REFRESH = "${pkg}.WIDGET_REFRESH"

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GoalWidgetProvider::class.java))
            for (id in ids) render(context, manager, id)
        }

        private fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val goal = GoalStore.random(context)
            val views = RemoteViews(context.packageName, R.layout.goal_widget)
            if (goal == null) {
                views.setTextViewText(R.id.goal_text, "Add a goal in the app")
                views.setTextViewText(R.id.goal_plan, "")
            } else {
                views.setTextViewText(R.id.goal_text, goal.wish)
                views.setTextViewText(R.id.goal_plan, if (goal.plan.isEmpty()) "" else "Plan: " + goal.plan)
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val refresh = Intent(context, GoalWidgetProvider::class.java).setAction(ACTION_REFRESH)
            views.setOnClickPendingIntent(R.id.goal_text, PendingIntent.getBroadcast(context, 1, refresh, flags))
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launch != null) {
                views.setOnClickPendingIntent(R.id.open_app, PendingIntent.getActivity(context, 2, launch, flags))
            }
            manager.updateAppWidget(id, views)
        }
    }
}
`,

  'OverlayReceiver.kt': `package ${pkg}

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.random.Random

object OverlaySchedule {
    const val PREFS = "woop_prefs"

    private fun pending(ctx: Context): PendingIntent {
        val i = Intent(ctx, OverlayReceiver::class.java).setAction("${pkg}.SHOW_OVERLAY")
        return PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun next(ctx: Context) {
        val minutes = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("minutes", 60).coerceAtLeast(15)
        val delayMs = (minutes + Random.nextInt(minutes + 1)) * 60000L
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMs, pending(ctx))
    }

    fun cancel(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pending(ctx))
    }
}

object OverlayView {
    private var current: View? = null
    private val handler = Handler(Looper.getMainLooper())

    fun dismiss(ctx: Context) {
        val v = current ?: return
        try {
            (ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v)
        } catch (e: Exception) {
        }
        current = null
    }

    fun show(ctx: Context) {
        val goal = GoalStore.random(ctx) ?: return
        dismiss(ctx)
        val d = ctx.resources.displayMetrics.density
        fun px(n: Int): Int = (n * d).toInt()

        val card = LinearLayout(ctx)
        card.orientation = LinearLayout.VERTICAL
        card.gravity = Gravity.CENTER_HORIZONTAL
        card.setPadding(px(24), px(24), px(24), px(20))
        val bg = GradientDrawable()
        bg.setColor(Color.parseColor("#F2183A28"))
        bg.cornerRadius = 20 * d
        card.background = bg

        val title = TextView(ctx)
        title.text = "Your goal"
        title.setTextColor(Color.parseColor("#B8D8C4"))
        title.textSize = 13f

        val wish = TextView(ctx)
        wish.text = goal.wish
        wish.setTextColor(Color.WHITE)
        wish.textSize = 24f
        wish.gravity = Gravity.CENTER
        wish.setPadding(0, px(10), 0, px(10))

        val plan = TextView(ctx)
        plan.text = if (goal.plan.isEmpty()) "" else "Plan: " + goal.plan
        plan.setTextColor(Color.parseColor("#D6E6DB"))
        plan.textSize = 14f
        plan.gravity = Gravity.CENTER

        val ok = Button(ctx)
        ok.text = "I will do it today"
        ok.setOnClickListener { dismiss(ctx) }

        card.addView(title)
        card.addView(wish)
        card.addView(plan)
        card.addView(ok)

        val lp = WindowManager.LayoutParams(
            (ctx.resources.displayMetrics.widthPixels * 0.88f).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        )
        lp.dimAmount = 0.5f
        lp.gravity = Gravity.CENTER
        try {
            (ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(card, lp)
            current = card
            handler.postDelayed({ dismiss(ctx) }, 15000)
        } catch (e: Exception) {
        }
    }
}

class OverlayReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences(OverlaySchedule.PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("enabled", false)) return
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && Settings.canDrawOverlays(app)) {
            OverlayView.show(app)
        }
        OverlaySchedule.next(app)
    }
}
`,

  'ScheduleActivity.kt': `package ${pkg}

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings

class ScheduleActivity : Activity() {
    private fun askPermission() {
        val i = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(i)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = applicationContext

        if (intent.getBooleanExtra("refresh", false)) {
            GoalWidgetProvider.refreshAll(app)
            finish()
            return
        }

        if (intent.getBooleanExtra("test", false)) {
            if (Settings.canDrawOverlays(app)) OverlayView.show(app) else askPermission()
            finish()
            return
        }

        val enable = intent.getBooleanExtra("enable", false)
        val minutes = intent.getDoubleExtra("minutes", 60.0).toInt()
        app.getSharedPreferences(OverlaySchedule.PREFS, MODE_PRIVATE)
            .edit().putBoolean("enabled", enable).putInt("minutes", minutes).apply()

        if (enable) {
            if (!Settings.canDrawOverlays(app)) askPermission()
            OverlaySchedule.next(app)
        } else {
            OverlaySchedule.cancel(app)
        }
        finish()
    }
}
`,
});

const widgetLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="14dp"
    android:background="@drawable/goal_widget_bg">

    <TextView
        android:id="@+id/goal_text"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:textColor="#FFFFFF"
        android:textSize="17sp"
        android:textStyle="bold"
        android:maxLines="3"
        android:ellipsize="end" />

    <TextView
        android:id="@+id/goal_plan"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:textColor="#D6E6DB"
        android:textSize="12sp"
        android:maxLines="2"
        android:ellipsize="end" />

    <TextView
        android:id="@+id/open_app"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="Open app"
        android:textColor="#FFFFFF"
        android:textSize="12sp"
        android:padding="4dp" />
</LinearLayout>
`;

const widgetBg = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#2D5A3D" />
    <corners android:radius="18dp" />
</shape>
`;

const widgetInfo = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/goal_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
`;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

module.exports = function withGoalWidget(config) {
  const pkg = (config.android && config.android.package) || 'com.harmish.woopgoals';

  config = withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECEIVE_BOOT_COMPLETED']) {
      if (!manifest['uses-permission'].some((p) => p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    const app = manifest.application[0];
    app.receiver = app.receiver || [];
    app.activity = app.activity || [];
    const has = (list, n) => list.some((x) => x.$['android:name'] === n);

    if (!has(app.receiver, '.GoalWidgetProvider')) {
      app.receiver.push({
        $: { 'android:name': '.GoalWidgetProvider', 'android:exported': 'true' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/goal_widget_info' } }],
      });
    }
    if (!has(app.receiver, '.OverlayReceiver')) {
      app.receiver.push({
        $: { 'android:name': '.OverlayReceiver', 'android:exported': 'false' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }] }],
      });
    }
    if (!has(app.activity, '.ScheduleActivity')) {
      app.activity.push({
        $: {
          'android:name': '.ScheduleActivity',
          'android:exported': 'true',
          'android:theme': '@android:style/Theme.NoDisplay',
          'android:excludeFromRecents': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': pkg + '.SCHEDULE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          },
        ],
      });
    }
    return c;
  });

  config = withDangerousMod(config, [
    'android',
    (c) => {
      const root = c.modRequest.platformProjectRoot;
      const srcDir = path.join(root, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      const resDir = path.join(root, 'app', 'src', 'main', 'res');
      const files = sources(pkg);
      for (const name of Object.keys(files)) write(path.join(srcDir, name), files[name]);
      write(path.join(resDir, 'layout', 'goal_widget.xml'), widgetLayout);
      write(path.join(resDir, 'drawable', 'goal_widget_bg.xml'), widgetBg);
      write(path.join(resDir, 'xml', 'goal_widget_info.xml'), widgetInfo);
      return c;
    },
  ]);

  return config;
};
