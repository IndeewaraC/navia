-- Calculate the active bi-weekly cycle and flag "Magic Months"
CREATE OR REPLACE FUNCTION public.get_pay_cycle_status(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_anchor_date DATE;
    v_current_date DATE := CURRENT_DATE;
    v_days_since_anchor INT;
    v_cycles_passed INT;
    v_cycle_start DATE;
    v_cycle_end DATE;
    v_paydays_in_month INT;
    v_is_magic_month BOOLEAN;
BEGIN
    -- Retrieve the user's base anchor pay date
    SELECT anchor_pay_date INTO v_anchor_date 
    FROM public.profiles 
    WHERE id = p_user_id;

    IF v_anchor_date IS NULL THEN
        RETURN json_build_object('error', 'Anchor pay date not configured');
    END IF;

    -- Calculate current 14-day window using numeric division to prevent truncation towards zero
    v_days_since_anchor := v_current_date - v_anchor_date;
    v_cycles_passed := FLOOR(v_days_since_anchor::NUMERIC / 14.0);
    
    v_cycle_start := v_anchor_date + (v_cycles_passed * 14);
    v_cycle_end := v_cycle_start + 13;

    -- Determine if the current calendar month contains 3 paydays
    WITH month_dates AS (
        SELECT generate_series(
            date_trunc('month', v_current_date)::date,
            (date_trunc('month', v_current_date) + interval '1 month - 1 day')::date,
            '1 day'::interval
        )::date AS cal_date
    )
    SELECT COUNT(*) INTO v_paydays_in_month
    FROM month_dates
    WHERE MOD((cal_date - v_anchor_date), 14) = 0;

    v_is_magic_month := v_paydays_in_month = 3;

    RETURN json_build_object(
        'cycle_start', v_cycle_start,
        'cycle_end', v_cycle_end,
        'days_remaining', v_cycle_end - v_current_date,
        'is_magic_month', v_is_magic_month,
        'paydays_this_month', v_paydays_in_month
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
