<?php
// Vex Hack Coin (VHC) - Klasa obslugi bazy danych
// Wersja: 1.0.0

require_once __DIR__ . '/config.inc';

class Database {
    private static $instance = null;
    private $pdo;

    private function __construct() {
        try {
            $dsn = "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";sslmode=require";
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            jsonError('Blad polaczenia z baza danych: ' . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getPdo() {
        return $this->pdo;
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetchOne($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }

    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }

    public function insert($sql, $params = []) {
        // Add RETURNING id for PostgreSQL, replace ? with $1,$2 style for RETURNING
        if (DB_DRIVER === 'pgsql' && stripos($sql, ' RETURNING ') === false) {
            $sql = rtrim($sql, '; ') . ' RETURNING id';
            $stmt = $this->query($sql, $params);
            $row = $stmt->fetch();
            return $row ? $row['id'] : null;
        }
        $this->query($sql, $params);
        return $this->pdo->lastInsertId();
    }

    public function beginTransaction() {
        return $this->pdo->beginTransaction();
    }

    public function commit() {
        return $this->pdo->commit();
    }

    public function rollback() {
        return $this->pdo->rollBack();
    }

}
