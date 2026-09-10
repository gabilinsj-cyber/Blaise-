package com.blaise.opentennis

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import kotlin.math.max
import kotlin.math.min

class TennisGameView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var aimX = 0f
    private var aimY = 0f
    private var hasAim = false

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        paint.color = 0xFF07172D.toInt()
        canvas.drawRect(0f, 0f, w, h, paint)

        val marginX = w * .14f
        val marginY = h * .08f
        val court = RectF(marginX, marginY, w - marginX, h - marginY)
        paint.color = 0xFF26724A.toInt()
        canvas.drawRect(court, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = max(2f, h * .004f)
        paint.color = 0xFFF5F3E8.toInt()
        canvas.drawRect(court, paint)
        val midY = court.centerY()
        canvas.drawLine(court.left, midY, court.right, midY, paint)
        val singlesInset = court.width() * .09f
        canvas.drawLine(court.left + singlesInset, court.top, court.left + singlesInset, court.bottom, paint)
        canvas.drawLine(court.right - singlesInset, court.top, court.right - singlesInset, court.bottom, paint)
        paint.style = Paint.Style.FILL

        paint.color = 0xFF111111.toInt()
        canvas.drawRect(court.left, midY - 2f, court.right, midY + 2f, paint)

        paint.color = 0xFFE8C04B.toInt()
        canvas.drawCircle(court.centerX(), court.bottom - court.height() * .12f, h * .018f, paint)
        paint.color = 0xFFF2F2F2.toInt()
        canvas.drawCircle(court.centerX(), court.top + court.height() * .12f, h * .018f, paint)

        if (hasAim) {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = max(3f, h * .006f)
            paint.color = 0xFF7CFF6B.toInt()
            canvas.drawCircle(aimX, aimY, h * .045f, paint)
            paint.style = Paint.Style.FILL
        }

        paint.textSize = max(20f, h * .045f)
        paint.color = 0xFFE8C04B.toInt()
        canvas.drawText("BLAISE OPEN TENNIS", w * .02f, h * .07f, paint)
        paint.textSize = max(14f, h * .026f)
        paint.color = 0xFFFFFFFF.toInt()
        canvas.drawText("Toque na quadra adversária para mirar", w * .02f, h * .12f, paint)
        canvas.drawText("0  0   |   0  0", w * .78f, h * .07f, paint)

        val buttons = listOf("Forehand", "Backhand", "Topspin", "Slice", "Lob", "Drop", "Volley")
        val gap = w * .006f
        val totalW = w * .72f
        val bw = (totalW - gap * (buttons.size - 1)) / buttons.size
        val by = h * .90f
        buttons.forEachIndexed { i, text ->
            val left = w * .14f + i * (bw + gap)
            paint.color = 0xCC0E2948.toInt()
            canvas.drawRoundRect(left, by, left + bw, h * .985f, 12f, 12f, paint)
            paint.color = 0xFFFFFFFF.toInt()
            paint.textSize = max(11f, h * .024f)
            canvas.drawText(text, left + bw * .08f, by + h * .052f, paint)
        }

        val joyX = w * .065f
        val joyY = h * .88f
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = max(3f, h * .006f)
        paint.color = 0x88FFFFFF.toInt()
        canvas.drawCircle(joyX, joyY, h * .065f, paint)
        canvas.drawCircle(joyX, joyY, h * .025f, paint)
        paint.style = Paint.Style.FILL
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN || event.action == MotionEvent.ACTION_MOVE) {
            val upperLimit = height * .50f
            if (event.y in (height * .08f)..upperLimit) {
                aimX = min(max(event.x, width * .14f), width * .86f)
                aimY = min(max(event.y, height * .08f), upperLimit)
                hasAim = true
                invalidate()
            }
            return true
        }
        return event.action == MotionEvent.ACTION_UP || super.onTouchEvent(event)
    }
}
