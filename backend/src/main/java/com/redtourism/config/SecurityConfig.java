package com.redtourism.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableWebSecurity
@SuppressWarnings("deprecation")
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.csrf().disable()
            .cors().and()
            .authorizeRequests()
                .antMatchers("/api/auth/**").permitAll()
                .antMatchers("/uploads/**").permitAll()
                .antMatchers("/api/admin/stats/**").hasAnyRole("ADMIN", "STAFF")
                .antMatchers("/api/admin/spot/**").hasAnyRole("ADMIN", "STAFF")
                .antMatchers("/api/admin/role/menu/list").hasAnyRole("ADMIN", "STAFF")
                .antMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().permitAll()
            .and()
            .formLogin().disable()
            .httpBasic().disable()
            .sessionManagement()
                .maximumSessions(5)
            .and().and()
            .rememberMe()
                .key("red-tourism-remember-me")
                .tokenValiditySeconds(604800);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance();
    }
}
