package com.financeai.dto;

public class LoginUidRequest {
    private String email;
    private String password; // Aquí viajará el auth_user_id de Supabase

    public LoginUidRequest() {}

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
