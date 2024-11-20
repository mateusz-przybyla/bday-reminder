import React, { useState, useEffect } from "react";

import { logoutUser, getUserInfo } from "../services/auth";

const useAuth = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const response = await getUserInfo();

      if (response.status === 200) {
        console.log("Auth info: ", response.status, response.statusText);
        setLoggedIn(true);
        setUsername(response.data.username);
      } else {
        console.log(
          "Auth info: ",
          response.response.status,
          response.response.data.error
        );
      }
    };
    checkAuth();
  }, []);

  const logout = async () => {
    await logoutUser();
    setLoggedIn(false);
  };

  return {
    loggedIn,
    setLoggedIn,
    logout,
    username,
  };
};

export default useAuth;
