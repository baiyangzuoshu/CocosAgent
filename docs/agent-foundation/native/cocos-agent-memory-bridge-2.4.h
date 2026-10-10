#pragma once

// Mac-native process-memory diagnostics for the Creator 2.4 JSB host.
// This reports process virtual/resident memory; it does not report GPU memory.

#include "cocos2d.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

#if CC_TARGET_PLATFORM == CC_PLATFORM_MAC
#include <mach/mach.h>

static bool cocos_agent_get_process_memory_info(se::State& state)
{
    if (!state.args().empty())
    {
        SE_REPORT_ERROR("getProcessMemoryInfo does not accept arguments");
        return false;
    }

    mach_task_basic_info_data_t info = {};
    mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
    const kern_return_t status = task_info(
        mach_task_self(),
        MACH_TASK_BASIC_INFO,
        reinterpret_cast<task_info_t>(&info),
        &count);
    if (status != KERN_SUCCESS)
    {
        SE_REPORT_ERROR("task_info(MACH_TASK_BASIC_INFO) failed: %d", status);
        return false;
    }

    se::Object* result = se::Object::createPlainObject();
    result->setProperty("residentBytes", se::Value(static_cast<double>(info.resident_size)));
    result->setProperty("virtualBytes", se::Value(static_cast<double>(info.virtual_size)));
    result->setProperty("unit", se::Value("bytes"));
    state.rval().setObject(result);
    result->decRef();
    return true;
}
SE_BIND_FUNC(cocos_agent_get_process_memory_info)

static bool cocos_agent_register_memory_bridge(se::Object* global)
{
    se::Value jsb;
    if (!global->getProperty("jsb", &jsb))
    {
        jsb.setObject(se::Object::createPlainObject());
        global->setProperty("jsb", jsb);
    }
    jsb.toObject()->defineFunction(
        "getProcessMemoryInfo",
        _SE(cocos_agent_get_process_memory_info));
    return true;
}
#endif
