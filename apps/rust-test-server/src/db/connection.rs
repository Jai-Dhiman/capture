use worker::*;

/// Database connection wrapper for consistent error handling
pub struct DbConnection {
    db: D1Database,
}

impl DbConnection {
    pub fn new(env: &Env) -> Result<Self> {
        let db = env
            .d1("DB")
            .map_err(|_| Error::RustError("Database connection failed".to_string()))?;

        Ok(Self { db })
    }

    /// Execute a prepared statement with parameters
    pub async fn execute_with_params<T>(&self, sql: &str, params: &[String]) -> Result<Option<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let js_params: Vec<_> = params.iter().map(|p| p.clone().into()).collect();
        let result = self
            .db
            .prepare(sql)
            .bind(&js_params)?
            .first::<T>(None)
            .await?;

        Ok(result)
    }

    /// Execute a prepared statement without parameters
    pub async fn execute<T>(&self, sql: &str) -> Result<Option<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let result = self.db.prepare(sql).first::<T>(None).await?;

        Ok(result)
    }

    /// Execute a query that returns multiple rows with parameters
    pub async fn execute_all_with_params<T>(&self, sql: &str, params: &[String]) -> Result<Vec<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let js_params: Vec<_> = params.iter().map(|p| p.clone().into()).collect();
        let result = self.db.prepare(sql).bind(&js_params)?.all().await?;

        // Convert D1Result to Vec<T>
        match result.results::<serde_json::Value>() {
            Ok(rows) => {
                let mut results = Vec::new();
                for row in rows {
                    let parsed: T = serde_json::from_value(row.clone()).map_err(|e| {
                        Error::RustError(format!("Failed to deserialize row: {}", e))
                    })?;
                    results.push(parsed);
                }
                Ok(results)
            }
            Err(e) => Err(e),
        }
    }

    /// Execute a query that returns multiple rows without parameters
    pub async fn execute_all<T>(&self, sql: &str) -> Result<Vec<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        let result = self.db.prepare(sql).all().await?;

        // Convert D1Result to Vec<T>
        match result.results::<serde_json::Value>() {
            Ok(rows) => {
                let mut results = Vec::new();
                for row in rows {
                    let parsed: T = serde_json::from_value(row.clone()).map_err(|e| {
                        Error::RustError(format!("Failed to deserialize row: {}", e))
                    })?;
                    results.push(parsed);
                }
                Ok(results)
            }
            Err(e) => Err(e),
        }
    }

    /// Execute a statement that doesn't return data (INSERT, UPDATE, DELETE) with parameters
    pub async fn execute_modify_with_params(
        &self,
        sql: &str,
        params: &[String],
    ) -> Result<D1Result> {
        let js_params: Vec<_> = params.iter().map(|p| p.clone().into()).collect();
        let result = self.db.prepare(sql).bind(&js_params)?.run().await?;

        Ok(result)
    }

    /// Execute a statement that doesn't return data (INSERT, UPDATE, DELETE) without parameters
    pub async fn execute_modify(&self, sql: &str) -> Result<D1Result> {
        let result = self.db.prepare(sql).run().await?;

        Ok(result)
    }

    /// Get a count from a query with parameters
    pub async fn count_with_params(&self, sql: &str, params: &[String]) -> Result<i64> {
        let result: Option<serde_json::Value> = self.execute_with_params(sql, params).await?;

        match result {
            Some(row) => row.get("count").and_then(|v| v.as_i64()).ok_or_else(|| {
                Error::RustError("Count query did not return a count field".to_string())
            }),
            None => Ok(0),
        }
    }

    /// Get a count from a query without parameters
    pub async fn count(&self, sql: &str) -> Result<i64> {
        let result: Option<serde_json::Value> = self.execute(sql).await?;

        match result {
            Some(row) => row.get("count").and_then(|v| v.as_i64()).ok_or_else(|| {
                Error::RustError("Count query did not return a count field".to_string())
            }),
            None => Ok(0),
        }
    }

    /// Check if a record exists with parameters
    pub async fn exists_with_params(&self, sql: &str, params: &[String]) -> Result<bool> {
        let count = self.count_with_params(sql, params).await?;
        Ok(count > 0)
    }

    /// Check if a record exists without parameters
    pub async fn exists(&self, sql: &str) -> Result<bool> {
        let count = self.count(sql).await?;
        Ok(count > 0)
    }
}
