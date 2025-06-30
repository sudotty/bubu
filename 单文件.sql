DROP INDEX IF EXISTS idx_f1_vin;
CREATE INDEX idx_f1_vin ON f1(VIN码);
DROP INDEX IF EXISTS idx_m1_vin;
CREATE INDEX idx_m1_vin ON m1(VIN码);
-- 创建已经续保了的新的m1表，f1表代表已经续保的表格，做关联条件筛选表，基底表以m1为主表
DROP TABLE IF EXISTS m1f1;
CREATE TABLE m1f1 AS
SELECT m1.*,
       CASE
           WHEN EXISTS (SELECT 1 FROM f1 WHERE f1.VIN码 = m1.VIN码) THEN 1
           ELSE 0 END AS is_xubao
FROM m1;

-- 更新离职员工交接后的员工信息
UPDATE m1f1
SET "服务经理工号(验车人工号）" = d1.C4,
    "服务经理姓名(验车人）"     = d1.C5
FROM d1
WHERE m1f1."服务经理工号(验车人工号）" = d1.C2;

-- 添加新的字段作为新部门
ALTER TABLE m1f1
    ADD COLUMN `服务经理新归属团队代码` VARCHAR(20);

ALTER TABLE m1f1
    ADD COLUMN `服务经理新归属团队` VARCHAR(50);

-- 合并组织新的组织架构
UPDATE m1f1
SET `服务经理新归属团队代码` = (SELECT `归属团队代码`
                                FROM c1
                                WHERE c1.`服务经理工号` = m1f1."服务经理工号(验车人工号）"
                                LIMIT 1),
    `服务经理新归属团队`     = (SELECT `归属团队名称`
                                FROM c1
                                WHERE c1.`服务经理工号` = m1f1."服务经理工号(验车人工号）"
                                LIMIT 1)
WHERE EXISTS (SELECT 1
              FROM c1
              WHERE c1.`服务经理工号` = m1f1.`服务经理工号(验车人工号）`);


update m1f1
SET 服务经理新归属团队代码 = '37029504',
    '服务经理新归属团队'   = '电销续保业务一部'
where 服务经理归属机构 = '青岛崂山支公司';

update m1f1
SET 服务经理新归属团队代码 = '37029808',
    '服务经理新归属团队'   = '电销续保业务部'
where 服务经理归属机构 = '青岛车险业务第二支公司';


update m1f1
SET 服务经理新归属团队代码 = '37029713', '服务经理新归属团队'   = '电销续保业务部'
where 服务经理归属机构 = '青岛车险业务第一支公司';


-- 对于B表中不存在的记录，保持原有团队信息
UPDATE m1f1
SET `服务经理新归属团队代码` = `服务经理归属团队代码`,
    `服务经理新归属团队`     = `服务经理归属团队`
WHERE `服务经理新归属团队代码` IS NULL;

-- 换部门的人员
update m1f1
set `服务经理新归属团队代码` = "37028605",
    `服务经理新归属团队`     = "电销续保业务二部"
where "服务经理工号(验车人工号）" in ("83748773", "A370201899");

-- 总续保率
SELECT SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) AS 续保分子, -- 分子：续保成功的保单数量
       COUNT(*)                                      AS 续保分母,
       ROUND(
               (SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)),
               9
       )                                             AS 大文件总续保率
FROM m1f1;
-- 团队续保率
SELECT
    服务经理归属机构,
    服务经理新归属团队代码,
    服务经理新归属团队,
    SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) AS 续保分子,  -- 分子：续保成功的保单数量
    COUNT(*) AS 续保分母,                          -- 分母：总保单数量
    ROUND(
            (SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)),
            2
    ) AS 归属团队续保率
FROM m1f1
GROUP BY 服务经理归属机构, 服务经理新归属团队代码, 服务经理新归属团队
ORDER BY 服务经理新归属团队代码 ,归属团队续保率 desc;

-- 经理续保率
SELECT
    m.服务经理归属机构,
    m.服务经理新归属团队代码,
    m.服务经理新归属团队,
    m."服务经理工号(验车人工号）",
    m."服务经理姓名(验车人）",
    m.续保分子,
    m.续保分母,
    m.续保率,
    CASE WHEN dd.人员代码 IS NOT NULL
             THEN '是'
         ELSE '否'
        END AS 是否在兜底小组
FROM (
         -- 原始查询作为子查询
         SELECT
             服务经理归属机构,
             服务经理新归属团队代码,
             服务经理新归属团队,
             "服务经理工号(验车人工号）",
             "服务经理姓名(验车人）",
             SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) AS 续保分子,
             COUNT(*) AS 续保分母,
             ROUND(
                     (SUM(CASE WHEN is_xubao = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)),
                     2
             ) AS 续保率
         FROM m1f1
         GROUP BY 服务经理归属机构, 服务经理新归属团队代码, 服务经理新归属团队, "服务经理工号(验车人工号）", "服务经理姓名(验车人）"
     ) m
         LEFT JOIN dd ON m."服务经理工号(验车人工号）" = dd.人员代码
ORDER BY m.服务经理新归属团队代码, m.续保率 DESC;

