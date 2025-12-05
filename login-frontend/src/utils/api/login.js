import config from '../../config/index';

/**
 * {Uøs API ¥ã
 */

/**
 * (7{U
 * @param {Object} loginData - (7{Upn
 * @param {string} loginData.email - ®±
 * @param {string} loginData.password - Æ
 * @returns {Promise<Object>} {UÓœ
 * @returns {string} returns.token - JWT token
 */
export const login = async (loginData) => {
  try {
    const response = await fetch(`${config.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: loginData.email,
        password: loginData.password
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      token: data.token
    };
  } catch (error) {
    console.error('{U÷B1%:', error);
    throw error;
  }
};