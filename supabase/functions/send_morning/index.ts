import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Verify this is called by cron (check for secret header)
    const cronSecret = req.headers.get('authorization')
    if (cronSecret !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
    )

    // Get all subscriptions with morning enabled
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('morning_enabled', true)

    if (error) throw error

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    const now = new Date()

    for (const sub of subscriptions) {
      try {
        // Check if it's 8:00 AM in user's timezone
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: sub.timezone }))
        const hour = userTime.getHours()
        const minute = userTime.getMinutes()

        // Only send if it's 8:00 AM (within 1 minute window)
        if (hour === 8 && minute >= 0 && minute < 1) {
          // Call send_push function
          const pushResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send_push`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({
                subscription_id: sub.user_id,
                payload: {
                  title: 'Reflect',
                  body: 'Set your 60-second intention',
                  tag: 'morning-reminder',
                  data: {
                    type: 'morning',
                    url: '/?view=morning',
                    action: 'morning',
                    actionTitle: 'Set Intention',
                  },
                },
              }),
            }
          )

          if (pushResponse.ok) {
            sent++
          }
        }
      } catch (err) {
        console.error(`Error sending to ${sub.user_id}:`, err)
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

