package io.github.etiennekepeklianmax.pikeo

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

// Starter widget for the native Android project. Install only after "npx cap add android".
// AppUrlOpen / getLaunchUrl delivery must be tested on a real device.
class PikeoWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (widgetId in ids) {
            val views = RemoteViews(context.packageName, R.layout.pikeo_widget)
            attach(context, views, R.id.widget_barcode, "barcode", 101)
            attach(context, views, R.id.widget_missing, "missing", 102)
            attach(context, views, R.id.widget_products, "products", 103)
            attach(context, views, R.id.widget_enf, "enf", 104)
            manager.updateAppWidget(widgetId, views)
        }
    }

    private fun attach(context: Context, views: RemoteViews, buttonId: Int, id: String, requestCode: Int) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("pikeo://shortcut/$id")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(buttonId, pending)
    }
}
