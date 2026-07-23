package com.financeai.dto;

public class LoginUidRequest {
    private String email;
    private String uid; // Aquí viajará el auth_user_id de Supabase

    public LoginUidRequest() {}

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getUid() { return uid; }
    public void setUid(String uid) { this.uid = uid; }
}
