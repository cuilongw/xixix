<template>
  <div class="login">
    <el-form
      ref="ruleFormRef"
      style="min-width: 400px"
      :model="ruleForm"
      status-icon
      :rules="rules"
      label-width="auto"
      class="login-form"
    >
      <h1>用户注册</h1>
      <el-form-item label="账号" prop="username">
        <el-input v-model="ruleForm.username" placeholder="请输入账号"  autocomplete="请输入账号" clearable />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="ruleForm.email" placeholder="请输入邮箱" autocomplete="请输入邮箱" clearable />
      </el-form-item>
      <el-form-item label="验证码" prop="code">
        <div class="sms-code-group">
          <el-input v-model="ruleForm.code" placeholder="请输入验证码" autocomplete="请输入验证码" clearable />
          <el-button
            :disabled="isCounting"
            @click="handleSendCode"
            type="primary"
            style="margin-left: 10px"
          >
            {{ isCounting ? `${countdown}s后重试` : '获取验证码' }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="ruleForm.password"
          type="password"
          placeholder="请输入密码"
          autocomplete="请输入密码"
          clearable
        />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="ruleForm.confirmPassword"
          type="password"
          placeholder="请输入确认密码"
          autocomplete="请输入确认密码"
          clearable
        />
      </el-form-item>

      <div class="login-btn">
        <el-button @click="resetForm(ruleFormRef)">重置</el-button>
        <el-button @click="router.push('/login')">返回</el-button>
        <el-button type="primary" @click="submitForm(ruleFormRef)">提交</el-button>
      </div>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { getRegisterApi, sendSmsCode } from "@/api/user";
import { useRouter } from "vue-router";

const router = useRouter();

const countdown = ref(0);
const isCounting = ref(false);
let countdownInterval: number | null = null;

const ruleFormRef = ref<FormInstance>();

const startCountdown = (seconds = 60) => {
  countdown.value = seconds;
  isCounting.value = true;
  countdownInterval = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(countdownInterval as number);
      countdownInterval = null;
      isCounting.value = false;
      countdown.value = 0;
    }
  }, 1000);
};

const stopCountdown = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  isCounting.value = false;
  countdown.value = 0;
};

const validateEmail = (rule: any, value: any, callback: any) => {
  if (value === "") {
    callback(new Error("请输入邮箱"));
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    callback(new Error("请输入有效的邮箱"));
  } else {
    callback();
  }
};

const validateCode = (rule: any, value: any, callback: any) => {
  if (value === "") {
    callback(new Error("请输入验证码"));
  } else if (!/^\d{4,6}$/.test(value)) {
    callback(new Error("请输入有效的验证码"));
  } else {
    callback();
  }
};

const validatePassword = (rule: any, value: any, callback: any) => {
  if (value === "") {
    callback(new Error("请输入密码"));
  } else {
    if (ruleForm.confirmPassword !== "") {
      if (!ruleFormRef.value) return;
      ruleFormRef.value.validateField("confirmPassword");
    }
    callback();
  }
};

const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (value === "") {
    callback(new Error("请再次输入密码"));
  } else if (value !== ruleForm.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const ruleForm = reactive({
  username: "",
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
});

const rules = reactive<FormRules<typeof ruleForm>>({
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  email: [{ required: true, validator: validateEmail, trigger: "blur" }],
  code: [{ required: true, validator: validateCode, trigger: "blur" }],
  password: [{ required: true, validator: validatePassword, trigger: "blur" }],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: "blur" },
  ],
});

const handleSendCode = async () => {
  const emailValid = await ruleFormRef.value?.validateField("email");
  if (emailValid) {
    try {
      const res = await sendSmsCode(ruleForm.email);
      if (res?.code === 200) {
        ElMessage.success("验证码已发送，请检查邮箱");
        startCountdown(60);
      } else {
        ElMessage.error(res?.message || "发送验证码失败");
      }
    } catch (error) {
      console.error("发送验证码失败:", error);
      ElMessage.error("网络错误，请稍后重试！");
    }
  }
};

const getRegister = async () => {
  if (!ruleForm.username.trim() || !ruleForm.password.trim()) {
    ElMessage.error("用户名或密码不能为空");
    return;
  }
  try {
    const res = await getRegisterApi({
      username: ruleForm.username,
      password: ruleForm.password,
      email: ruleForm.email,
      code: ruleForm.code,
    });

    if (res.code === 200) {
      ElMessage.success("注册成功！");
      stopCountdown();
      router.push("/login");
    } else {
      console.error("注册失败:", res.message);
      ElMessage.error(res.message || "注册失败，请重试！");
    }
  } catch (error) {
    console.error("注册请求失败:", error);
    ElMessage.error("网络错误，请稍后重试！");
  }
};

const submitForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  formEl.validate((valid) => {
    if (valid) {
      getRegister();
    }
  });
};

const resetForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  stopCountdown();
  formEl.resetFields();
};
</script>
<style scoped lang="scss">
.login {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    h1 {
        color: #FFF;
        font-size: 30px;
        margin-bottom: 20px;
    }
    :deep(){
        .el-form-item__label{
            color: #FFF;
        }
    }
    .login-form {
        width: 400px;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 5px;

        // margin:auto;
      .sms-code-group {
        display: flex;
        align-items: center;
      }
        .login-btn {
            display: flex;
            justify-content: center;
            margin-top: 20px;
        }
    }
}

    @media (max-width: 480px) {
      .login {
        padding: 20px 0;
      }
      .login .login-form {
        transform: scale(0.9);
        transform-origin: top center;
        width: 100%;
        max-width: 100%;
        min-width: 0 !important;
      }
    }
</style>