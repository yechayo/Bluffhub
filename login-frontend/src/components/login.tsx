import "./login.less"
import { useState } from "react"
// @ts-ignore
import { register } from "../utils/api/auth"
// @ts-ignore
import { login } from "../utils/api/login"
// @ts-ignore
import { sendTokenToParent, sendErrorToParent } from "./postMessage.jsx"

export default function Login() {
    const [isActive, setIsActive] = useState(false)

    // 登录表单状态
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')

    // 登录中状态
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    // 注册表单状态
    const [registerName, setRegisterName] = useState('')
    const [registerEmail, setRegisterEmail] = useState('')
    const [registerPassword, setRegisterPassword] = useState('')
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
    const [registerAboutMe, setRegisterAboutMe] = useState('')

    // 表单验证错误状态
    const [errors, setErrors] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        aboutMe: ''
    })

    // 注册中状态
    const [isRegistering, setIsRegistering] = useState(false)

    // 验证函数
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    const validatePassword = (password: string): boolean => {
        // 8位以上即可
        return password.length >= 8;
    }

    const validateName = (name: string): boolean => {
        // 支持中英文和数字
        const nameRegex = /^[A-Za-z0-9\u4e00-\u9fa5]+$/;
        return nameRegex.test(name) && name.length > 0;
    }

    // 清除单个字段错误
    const clearError = (field: string) => {
        setErrors(prev => ({
            ...prev,
            [field]: ''
        }));
    }

    const handleRegisterChoiceClick = () => {
        setIsActive(true)
        console.log("开了");
    }

    const handleLoginChoiceClick = () => {
        setIsActive(false)
        console.log("关了");
    }

    const handleLoginClick = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        // 验证邮箱
        if (!loginEmail.trim()) {
            sendErrorToParent('邮箱不能为空', 'LOGIN_ERROR');
            return;
        }

        if (!validateEmail(loginEmail)) {
            sendErrorToParent('邮箱格式不正确', 'LOGIN_ERROR');
            return;
        }

        // 验证密码
        if (!loginPassword.trim()) {
            sendErrorToParent('密码不能为空', 'LOGIN_ERROR');
            return;
        }

        setIsLoggingIn(true);

        try {
            const result = await login({
                email: loginEmail,
                password: loginPassword
            });

            console.log("登录成功:", result.token);
            // 登录成功后，发送token给父应用
            sendTokenToParent(result.token);

        } catch (error) {
            console.error("登录失败:", error);
            const errorMessage = `登录失败: ${error instanceof Error ? error.message : String(error)}`;
            sendErrorToParent(errorMessage, 'LOGIN_ERROR');
        } finally {
            setIsLoggingIn(false);
        }
    }

    const validateRegisterForm = (): boolean => {
        const newErrors = {
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            aboutMe: ''
        };

        let isValid = true;

        // 验证用户名
        if (!registerName.trim()) {
            newErrors.name = '用户名不能为空';
            isValid = false;
        } else if (!validateName(registerName)) {
            newErrors.name = '用户名只能包含中英文和数字';
            isValid = false;
        }

        // 验证邮箱（必填）
        if (!registerEmail.trim()) {
            newErrors.email = '邮箱不能为空';
            isValid = false;
        } else if (!validateEmail(registerEmail)) {
            newErrors.email = '邮箱格式不正确';
            isValid = false;
        }

        // 验证密码
        if (!validatePassword(registerPassword)) {
            newErrors.password = '密码长度必须至少8位';
            isValid = false;
        }

        // 验证确认密码
        if (registerPassword !== registerConfirmPassword) {
            newErrors.confirmPassword = '两次密码输入不一致';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    }

    const handleRegisterClick = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!validateRegisterForm()) {
            return;
        }

        setIsRegistering(true);

        try {
            const result = await register({
                name: registerName,
                email: registerEmail,
                password: registerPassword,
                aboutMe: registerAboutMe || 'null'
            });

            console.log("注册成功:", result.token);
            // 注册成功后，发送token给父应用
            sendTokenToParent(result.token);

            // 重置表单
            setRegisterName('');
            setRegisterEmail('');
            setRegisterPassword('');
            setRegisterConfirmPassword('');
            setRegisterAboutMe('');

        } catch (error) {
            console.error("注册失败:", error);
            const errorMessage = `注册失败: ${error instanceof Error ? error.message : String(error)}`;
            sendErrorToParent(errorMessage, 'REGISTER_ERROR');
        } finally {
            setIsRegistering(false);
        }
    }

    return (
        <div className={`container ${isActive ? "active" : ""}`} id="container">
            <div className="form-container sign-up">
                <form onSubmit={handleRegisterClick}>
                    <h1>创建新用户</h1>
                    <input
                        type="text"
                        value={registerName}
                        onChange={(e) => {
                            setRegisterName(e.target.value);
                            clearError('name');
                        }}
                        placeholder="用户名 *"
                    />
                    {errors.name && <div style={{color: 'red', fontSize: '12px', marginTop: '5px'}}>{errors.name}</div>}

                    <input
                        type="email"
                        value={registerEmail}
                        onChange={(e) => {
                            setRegisterEmail(e.target.value);
                            clearError('email');
                        }}
                        placeholder="邮箱 *"
                    />
                    {errors.email && <div style={{color: 'red', fontSize: '12px', marginTop: '5px'}}>{errors.email}</div>}

                    <input
                        type="password"
                        value={registerPassword}
                        onChange={(e) => {
                            setRegisterPassword(e.target.value);
                            clearError('password');
                        }}
                        placeholder="密码 *"
                    />
                    {errors.password && <div style={{color: 'red', fontSize: '12px', marginTop: '5px'}}>{errors.password}</div>}

                    <input
                        type="password"
                        value={registerConfirmPassword}
                        onChange={(e) => {
                            setRegisterConfirmPassword(e.target.value);
                            clearError('confirmPassword');
                        }}
                        placeholder="确认密码 *"
                    />
                    {errors.confirmPassword && <div style={{color: 'red', fontSize: '12px', marginTop: '5px'}}>{errors.confirmPassword}</div>}

                    <input
                        type="text"
                        value={registerAboutMe}
                        onChange={(e) => setRegisterAboutMe(e.target.value)}
                        placeholder="个人简介（选填）"
                    />

                    <button type="submit" disabled={isRegistering}>
                        {isRegistering ? '注册中...' : '注册'}
                    </button>
                </form>
            </div>
            <div className="form-container sign-in">
                <form onSubmit={handleLoginClick}>
                    <h1>登录</h1>
                    <div className="social-icons">
                        {/* <a href="" className="icon">微信</a>
                        <a href="" className="icon">QQ</a> */}
                    </div>
                    <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="邮箱" />
                    <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="密码" />
                    <button type="submit" disabled={isLoggingIn}>
                        {isLoggingIn ? '登录中...' : '登录'}
                    </button>
                </form>
            </div>
            <div className="toggle-container">
                <div className="toggle">
                    <div className="toggle-panel toggle-left">
                        <h1>欢迎回来</h1>
                        <button className="hidden" id="login" onClick={handleLoginChoiceClick}>登录</button>
                    </div>
                    <div className="toggle-panel toggle-right">
                        <h1>你好，新朋友</h1>
                        <button className="hidden" id="register" onClick={handleRegisterChoiceClick}>注册</button>
                    </div>
                </div>
            </div>
        </div>
    )
}