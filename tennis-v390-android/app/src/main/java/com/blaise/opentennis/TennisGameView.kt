package com.blaise.opentennis

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import kotlin.math.max
import kotlin.math.min

enum class MemorablePlayer { LOCAL, OPPONENT }

class TennisGameView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val memorableAudio = MemorableAudioEngine()
    private val memorable = MemorablePresentationController()
    private val replayCatalog = MemorableReplayCatalog()
    private val competitiveTelemetry = CompetitiveTelemetry()
    private var aimX = 0f; private var aimY = 0f; private var hasAim = false
    private var currentSetNumber = 1

    fun competitiveSnapshot(): CompetitiveSnapshot = competitiveTelemetry.snapshot()
    fun recordNetworkSample(rttMs: Long, serverError: Boolean = false) = competitiveTelemetry.onNetworkSample(rttMs, serverError)
    fun recordAuthoritativeTick(localTick: Long, authoritativeTick: Long) = competitiveTelemetry.onAuthoritativeTick(localTick, authoritativeTick)
    fun recordPhysicsInvariant(valid: Boolean) = competitiveTelemetry.onPhysicsInvariant(valid)
    fun recordRiskSignal(strong: Boolean) = competitiveTelemetry.onRiskSignal(strong)
    fun registerMemorableReplay(replay: MemorableReplay): Boolean = replayCatalog.register(replay)
    fun postMatchUnwatchedReplays(): List<MemorableReplay> = replayCatalog.postMatchUnwatched()
    fun markMemorableReplayWatched(eventId: String): Boolean = replayCatalog.markWatched(eventId)
    fun visibleSetReplays(): List<MemorableReplay> {
        if (!memorable.state.replayAvailable) return emptyList()
        val filter = when (memorable.state.replayFilter) {
            MemorableReplayFilter.ALL -> ReplayFilter.ALL
            MemorableReplayFilter.LOCAL -> ReplayFilter.LOCAL
            MemorableReplayFilter.OPPONENT -> ReplayFilter.OPPONENT
        }
        return replayCatalog.forSet(currentSetNumber, filter)
    }

    fun onMemorableConfirmed(player: MemorablePlayer, total: Int, localCount: Int, opponentCount: Int, nowMs: Long = SystemClock.uptimeMillis()) {
        memorable.onAuthoritativeConfirmed(player,total,localCount,opponentCount,nowMs)
        if(memorable.consumeApplauseCue()) memorableAudio.playStandingOvation()
        invalidate();postInvalidateDelayed(1250L);postInvalidateDelayed(2250L)
    }
    fun onSetBreakStarted(setNumber: Int = currentSetNumber) { currentSetNumber=setNumber; memorable.onSetBreakStarted(); invalidate() }
    fun closeMemorableReplayPanel(){memorable.closeReplayPanel();invalidate()}
    fun memorableReplayCount():Int=memorable.state.cameraBadgeTotal
    fun memorableReplayCount(player:MemorablePlayer):Int=if(player==MemorablePlayer.LOCAL)memorable.state.localCount else memorable.state.opponentCount
    fun resetMemorablePresentationForNewSet(nextSetNumber:Int=currentSetNumber+1){currentSetNumber=nextSetNumber;memorable.resetForNewSet();invalidate()}
    override fun onDetachedFromWindow(){memorableAudio.release();super.onDetachedFromWindow()}

    override fun onDraw(canvas:Canvas){competitiveTelemetry.onDraw();super.onDraw(canvas);val w=width.toFloat();val h=height.toFloat();val now=SystemClock.uptimeMillis();paint.style=Paint.Style.FILL;paint.color=0xFF07172D.toInt();paint.alpha=255;canvas.drawRect(0f,0f,w,h,paint);val court=RectF(w*.14f,h*.08f,w*.86f,h*.92f);paint.color=0xFF26724A.toInt();canvas.drawRect(court,paint);paint.style=Paint.Style.STROKE;paint.strokeWidth=max(2f,h*.004f);paint.color=0xFFF5F3E8.toInt();canvas.drawRect(court,paint);val midY=court.centerY();canvas.drawLine(court.left,midY,court.right,midY,paint);val inset=court.width()*.09f;canvas.drawLine(court.left+inset,court.top,court.left+inset,court.bottom,paint);canvas.drawLine(court.right-inset,court.top,court.right-inset,court.bottom,paint);paint.style=Paint.Style.FILL;paint.color=0xFF111111.toInt();canvas.drawRect(court.left,midY-2f,court.right,midY+2f,paint);paint.color=0xFFE8C04B.toInt();canvas.drawCircle(court.centerX(),court.bottom-court.height()*.12f,h*.018f,paint);paint.color=0xFFF2F2F2.toInt();canvas.drawCircle(court.centerX(),court.top+court.height()*.12f,h*.018f,paint);if(hasAim){paint.style=Paint.Style.STROKE;paint.strokeWidth=max(3f,h*.006f);paint.color=0xFF7CFF6B.toInt();canvas.drawCircle(aimX,aimY,h*.045f,paint);paint.style=Paint.Style.FILL};paint.textSize=max(20f,h*.045f);paint.color=0xFFE8C04B.toInt();canvas.drawText("BLAISE OPEN TENNIS",w*.02f,h*.07f,paint);paint.textSize=max(14f,h*.026f);paint.color=0xFFFFFFFF.toInt();canvas.drawText("Toque na quadra adversária para mirar",w*.02f,h*.12f,paint);canvas.drawText("0  0   |   0  0",w*.78f,h*.07f,paint)
        val state=memorable.state;if(now<state.standingOvationUntilMs){val rise=((now-state.standingOvationStartedMs).coerceAtLeast(0L)/320f).coerceIn(0f,1f);paint.color=0xCCF5F3E8.toInt();val y=h*.16f;for(i in 0 until 18){val x=w*.16f+i*(w*.68f/17f);val personRise=((rise-(i%4)*.045f).coerceIn(0f,1f))*h*.020f;canvas.drawCircle(x,y-personRise,h*.010f,paint);canvas.drawRect(x-h*.006f,y+h*.010f-personRise,x+h*.006f,y+h*.040f-personRise,paint)};postInvalidateOnAnimation()};if(now<state.overlayUntilMs){paint.textAlign=Paint.Align.CENTER;paint.typeface=android.graphics.Typeface.DEFAULT_BOLD;paint.textSize=max(28f,h*.075f);paint.color=0xFFFFD55A.toInt();canvas.drawText("MEMORABLE",w*.50f,if(state.lastPlayer==MemorablePlayer.LOCAL)h*.69f else h*.30f,paint);paint.typeface=android.graphics.Typeface.DEFAULT;paint.textAlign=Paint.Align.LEFT;postInvalidateOnAnimation()}
        val cameraX=w*.93f;val cameraY=h*.84f;paint.color=0xCC0E2948.toInt();canvas.drawRoundRect(cameraX-h*.055f,cameraY-h*.04f,cameraX+h*.055f,cameraY+h*.04f,12f,12f,paint);paint.color=0xFFFFFFFF.toInt();paint.textSize=max(11f,h*.022f);canvas.drawText("CAM",cameraX-h*.027f,cameraY+h*.008f,paint);val count=state.cameraBadgeTotal;if(count>0){val bx=cameraX+h*.052f;val by=cameraY-h*.038f;paint.color=0xFFE32636.toInt();canvas.drawCircle(bx,by,h*.022f,paint);paint.color=0xFFFFFFFF.toInt();paint.textAlign=Paint.Align.CENTER;canvas.drawText(if(count>99)"99+" else count.toString(),bx,by+h*.007f,paint);paint.textAlign=Paint.Align.LEFT};val buttons=listOf("Forehand","Backhand","Topspin","Slice","Lob","Drop","Volley");val gap=w*.006f;val bw=(w*.72f-gap*(buttons.size-1))/buttons.size;val by=h*.90f;buttons.forEachIndexed{i,text->val left=w*.14f+i*(bw+gap);paint.color=0xCC0E2948.toInt();canvas.drawRoundRect(left,by,left+bw,h*.985f,12f,12f,paint);paint.color=0xFFFFFFFF.toInt();paint.textSize=max(11f,h*.024f);canvas.drawText(text,left+bw*.08f,by+h*.052f,paint)};paint.style=Paint.Style.STROKE;paint.color=0x88FFFFFF.toInt();canvas.drawCircle(w*.065f,h*.88f,h*.065f,paint);canvas.drawCircle(w*.065f,h*.88f,h*.025f,paint);paint.style=Paint.Style.FILL;if(state.replayPanelVisible)drawReplayPanel(canvas,w,h,state)}

    private fun drawReplayPanel(canvas:Canvas,w:Float,h:Float,state:MemorableUiState){paint.color=0xE607172D.toInt();canvas.drawRoundRect(w*.20f,h*.18f,w*.80f,h*.78f,28f,28f,paint);paint.textAlign=Paint.Align.CENTER;paint.typeface=android.graphics.Typeface.DEFAULT_BOLD;paint.color=0xFFFFD55A.toInt();paint.textSize=max(24f,h*.052f);canvas.drawText("JOGADAS MEMORÁVEIS",w*.50f,h*.29f,paint);paint.typeface=android.graphics.Typeface.DEFAULT;paint.color=0xFFFFFFFF.toInt();paint.textSize=max(16f,h*.032f);canvas.drawText("Você: ${state.localCount} | Adversário: ${state.opponentCount} | Total: ${state.cameraBadgeTotal}",w*.50f,h*.38f,paint);canvas.drawText("Set $currentSetNumber • ${visibleSetReplays().size} replay(s) no filtro",w*.50f,h*.45f,paint);val labels=listOf("TODAS" to MemorableReplayFilter.ALL,"SUAS" to MemorableReplayFilter.LOCAL,"ADVERSÁRIO" to MemorableReplayFilter.OPPONENT);labels.forEachIndexed{i,(label,filter)->val left=w*(.27f+i*.17f);val right=left+w*.14f;val top=h*.53f;val bottom=h*.62f;paint.color=if(state.replayFilter==filter)0xFFE8C04B.toInt() else 0xCC0E2948.toInt();canvas.drawRoundRect(left,top,right,bottom,18f,18f,paint);paint.color=if(state.replayFilter==filter)0xFF07172D.toInt() else 0xFFFFFFFF.toInt();paint.textSize=max(12f,h*.024f);canvas.drawText(label,(left+right)/2f,top+h*.055f,paint)};paint.color=0xCCE32636.toInt();canvas.drawRoundRect(w*.43f,h*.67f,w*.57f,h*.74f,18f,18f,paint);paint.color=0xFFFFFFFF.toInt();canvas.drawText("FECHAR",w*.50f,h*.715f,paint);paint.textAlign=Paint.Align.LEFT}

    override fun onTouchEvent(event:MotionEvent):Boolean{if(event.action!=MotionEvent.ACTION_DOWN&&event.action!=MotionEvent.ACTION_MOVE&&event.action!=MotionEvent.ACTION_UP)return super.onTouchEvent(event);val state=memorable.state;if(event.action==MotionEvent.ACTION_DOWN&&state.replayPanelVisible){val x=event.x/width.toFloat();val y=event.y/height.toFloat();when{x in .27f..41f&&y in .53f..62f->memorable.selectReplayFilter(MemorableReplayFilter.ALL);x in .44f..58f&&y in .53f..62f->memorable.selectReplayFilter(MemorableReplayFilter.LOCAL);x in .61f..75f&&y in .53f..62f->memorable.selectReplayFilter(MemorableReplayFilter.OPPONENT);x in .43f..57f&&y in .67f..74f->memorable.closeReplayPanel()};invalidate();return true};if(event.action==MotionEvent.ACTION_DOWN){val cx=width*.93f;val cy=height*.84f;if(event.x in(cx-height*.07f)..(cx+height*.07f)&&event.y in(cy-height*.06f)..(cy+height*.06f)){if(memorable.openReplayPanel())invalidate();return true}};if(event.action==MotionEvent.ACTION_DOWN||event.action==MotionEvent.ACTION_MOVE){competitiveTelemetry.onInput(event.eventTime*1_000_000L);val upper=height*.50f;if(event.y in(height*.08f)..upper){aimX=min(max(event.x,width*.14f),width*.86f);aimY=min(max(event.y,height*.08f),upper);hasAim=true;invalidate()};return true};return event.action==MotionEvent.ACTION_UP||super.onTouchEvent(event)}
}
