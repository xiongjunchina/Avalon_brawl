-- Migration 015: Delete zero-game user '老熊' (player_code: 999999) and bound dedicated room
-- Strictly protects any other user named '老熊' (such as player_code: 616755 with game history)

DO $$
DECLARE
  v_target_user_id uuid;
  v_game_count integer;
  v_deleted_room_count integer := 0;
BEGIN
  -- 1. 精确锁定目标用户：昵称必须为'老熊'，仙友码必须为'999999'，且明确排除仙友码'616755'
  SELECT id INTO v_target_user_id
  FROM users
  WHERE player_code = '999999'
    AND nickname = '老熊'
    AND player_code <> '616755';

  IF v_target_user_id IS NULL THEN
    RAISE NOTICE '未找到仙友码为 999999 的老熊用户，可能已清理或不存在，跳过执行。';
    RETURN;
  END IF;

  -- 2. 双重安全检查：确认该用户的历史对局数为 0
  SELECT count(*) INTO v_game_count
  FROM game_participants
  WHERE user_id = v_target_user_id;

  IF v_game_count > 0 THEN
    RAISE EXCEPTION '安全检查中止：该老熊账号(999999)存在 % 局历史对局记录，拒绝删除！', v_game_count;
  END IF;

  -- 3. 解除历史/空闲房间对该专属房的引用
  UPDATE rooms
  SET dedicated_room_id = NULL
  WHERE dedicated_room_id IN (
    SELECT id FROM dedicated_rooms WHERE manager_id = v_target_user_id
  );

  -- 4. 删除其绑定的专属房
  DELETE FROM dedicated_rooms
  WHERE manager_id = v_target_user_id;
  GET DIAGNOSTICS v_deleted_room_count = ROW_COUNT;

  -- 5. 清理该用户创建但未开局的房间及关联数据
  DELETE FROM command_receipts
  WHERE room_id IN (
    SELECT id FROM rooms WHERE host_id = v_target_user_id AND id NOT IN (SELECT room_id FROM games)
  );

  DELETE FROM room_members
  WHERE room_id IN (
    SELECT id FROM rooms WHERE host_id = v_target_user_id AND id NOT IN (SELECT room_id FROM games)
  );

  DELETE FROM rooms
  WHERE host_id = v_target_user_id AND id NOT IN (SELECT room_id FROM games);

  -- 6. 清理该用户的会话、指令记录、预设、收藏、房间成员等关联记录
  DELETE FROM sessions WHERE user_id = v_target_user_id;
  DELETE FROM command_receipts WHERE user_id = v_target_user_id;
  DELETE FROM setting_presets WHERE user_id = v_target_user_id;
  DELETE FROM favorites WHERE user_id = v_target_user_id;
  DELETE FROM room_members WHERE user_id = v_target_user_id;

  -- 7. 若在靓号预留或安全审计中存在引用，重置其关联
  UPDATE player_code_reservations SET user_id = NULL WHERE user_id = v_target_user_id;
  UPDATE player_code_audit SET user_id = NULL WHERE user_id = v_target_user_id;
  UPDATE content_safety_reviews SET user_id = NULL WHERE user_id = v_target_user_id;
  UPDATE content_safety_checks SET user_id = NULL WHERE user_id = v_target_user_id;

  -- 8. 彻底注销并删除目标用户账号
  DELETE FROM users WHERE id = v_target_user_id;

  RAISE NOTICE '已成功清理无对局老熊(999999)及其绑定的专属房(% 间)，保留有对局记录的老熊(616755)。', v_deleted_room_count;
END $$;
