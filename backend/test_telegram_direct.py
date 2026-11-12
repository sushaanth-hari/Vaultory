import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.telegram_service import telegram_service

async def run_all_tests():
    print("=" * 60)
    print("VAULTORY TELEGRAM BOT SERVICE VERIFICATION SUITE")
    print("=" * 60)

    test_chat_id = "9188525411"
    
    # 1. Test /start with user ID 1
    print("\n--- Test 1: /start with User ID 1 ---")
    r1 = await telegram_service.process_telegram_update({
        "update_id": 1001,
        "message": {
            "message_id": 1,
            "chat": {"id": int(test_chat_id), "type": "private"},
            "from": {"id": int(test_chat_id), "username": "alex_telegram"},
            "text": "/start 1"
        }
    })
    print(f"Status: {r1['status']}, Command: {r1['command']}")
    print(f"Reply:\n{r1['reply_text']}")
    assert r1['status'] == 'processed'
    assert "Welcome to Vaultory" in r1['reply_text']

    # 2. Test duplicate update_id (Requirement 4)
    print("\n--- Test 2: Duplicate Update Prevention ---")
    r_dup = await telegram_service.process_telegram_update({
        "update_id": 1001,
        "message": {
            "message_id": 2,
            "chat": {"id": int(test_chat_id)},
            "text": "/start 1"
        }
    })
    print(f"Status: {r_dup['status']}, Reason: {r_dup.get('reason')}")
    assert r_dup['status'] == 'skipped'
    assert r_dup.get('reason') == 'duplicate'

    # 3. Test /warranties command
    print("\n--- Test 3: /warranties Command ---")
    r_w = await telegram_service.process_telegram_update({
        "update_id": 1002,
        "message": {
            "message_id": 3,
            "chat": {"id": int(test_chat_id)},
            "text": "/warranties"
        }
    })
    print(f"Status: {r_w['status']}, Command: {r_w['command']}")
    print(f"Reply:\n{r_w['reply_text']}")
    assert r_w['status'] == 'processed'

    # 4. Test /status command
    print("\n--- Test 4: /status Command ---")
    r_s = await telegram_service.process_telegram_update({
        "update_id": 1003,
        "message": {
            "message_id": 4,
            "chat": {"id": int(test_chat_id)},
            "text": "/status"
        }
    })
    print(f"Status: {r_s['status']}, Command: {r_s['command']}")
    print(f"Reply:\n{r_s['reply_text']}")
    assert r_s['status'] == 'processed'
    assert "Vaultory Account Status" in r_s['reply_text']

    # 5. Test /help command
    print("\n--- Test 5: /help Command ---")
    r_h = await telegram_service.process_telegram_update({
        "update_id": 1004,
        "message": {
            "message_id": 5,
            "chat": {"id": int(test_chat_id)},
            "text": "/help"
        }
    })
    print(f"Status: {r_h['status']}, Command: {r_h['command']}")
    assert r_h['status'] == 'processed'
    assert "/warranties" in r_h['reply_text']

    # 6. Test Unrecognized command / invalid message handling (Requirement 4)
    print("\n--- Test 6: Invalid Command Handling ---")
    r_unknown = await telegram_service.process_telegram_update({
        "update_id": 1005,
        "message": {
            "message_id": 6,
            "chat": {"id": int(test_chat_id)},
            "text": "/foobar_invalid"
        }
    })
    print(f"Status: {r_unknown['status']}, Command: {r_unknown['command']}")
    print(f"Reply:\n{r_unknown['reply_text']}")
    assert r_unknown['status'] == 'processed'
    assert "Unrecognized Command" in r_unknown['reply_text']

    # 7. Test /unlink command
    print("\n--- Test 7: /unlink Command ---")
    r_unl = await telegram_service.process_telegram_update({
        "update_id": 1006,
        "message": {
            "message_id": 7,
            "chat": {"id": int(test_chat_id)},
            "text": "/unlink"
        }
    })
    print(f"Status: {r_unl['status']}, Command: {r_unl['command']}")
    print(f"Reply:\n{r_unl['reply_text']}")
    assert r_unl['status'] == 'processed'
    assert "Vaultory Disconnected" in r_unl['reply_text']

    # 8. Re-link via /link <email>
    print("\n--- Test 8: /link by Email ---")
    r_link = await telegram_service.process_telegram_update({
        "update_id": 1007,
        "message": {
            "message_id": 8,
            "chat": {"id": int(test_chat_id), "type": "private"},
            "from": {"id": int(test_chat_id), "username": "alex_telegram"},
            "text": "/link pr@gmail.com"
        }
    })
    print(f"Status: {r_link['status']}, Command: {r_link['command']}")
    print(f"Reply:\n{r_link['reply_text']}")
    assert r_link['status'] == 'processed'
    assert "Successfully Connected" in r_link['reply_text']

    print("\n" + "=" * 60)
    print("ALL TELEGRAM BOT INTEGRATION TESTS PASSED 100%!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
