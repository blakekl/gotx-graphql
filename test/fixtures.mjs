export const programs = ['gotm', 'retro', 'rpg', 'goty', 'gotwoty'];
export const publicIds = programs.flatMap((_, p) =>
  [1, 3, 5].map((i) => p * 100 + i),
);
export const privateIds = programs.flatMap((_, p) =>
  [2, 4, 6].map((i) => p * 100 + i),
);

export async function seedMembers(pool) {
  await pool.query(`INSERT INTO users(id,name,earned_points,discord_id,admin,current_points,premium_subscriber)
    VALUES (2,'Public member',12.5,123456789,true,999,'private'),
      (3,'Zero public nominations',0,987654321,false,999,'private');`);
}

// Small ordinary example: two public themes, three games, four nominations.
export async function seedPublicExample(pool) {
  await seedMembers(pool);
  await pool.query(`
    INSERT INTO themes VALUES (5,'Monthly theme','Monthly description','2026-01-01','gotm'),
      (305,'Annual theme','Annual description','2026-01-01','goty');
    INSERT INTO games(id,title_world,year,time_to_beat,screenscraper_id,igdb_id)
      VALUES (5,'Monthly winner','1995',20,123,456), (305,'Annual winner','1995',30,789,987),
        (9000,'Shared game','2000',10,NULL,NULL);
    INSERT INTO nominations VALUES (50,'gotm','Winner',true,5,2,5),
      (51,'gotm','Runner-up',false,9000,2,5),
      (3050,'goty','Winner',true,305,2,305), (3051,'goty','Runner-up',false,9000,2,305);
    INSERT INTO completions SELECT id,'2026-01-02',id,2,false FROM nominations;
  `);
}

// Only publication scenarios need the date/winner/program cross-product.
export async function seedPublicationMatrix(pool) {
  await seedMembers(pool);
  await pool.query(
    "INSERT INTO games(id,title_world,year,time_to_beat) VALUES (9000,'Shared game','2000',10)",
  );
  for (const [p, program] of programs.entries()) {
    for (let i = 1; i <= 6; i++) {
      const id = p * 100 + i;
      const winner = i % 2 === 1;
      const offset = [-100, -99, 0, 0, 100, 101][i - 1];
      await pool.query(
        'INSERT INTO themes VALUES ($1,$2,$3,CURRENT_DATE + $4::int,$5)',
        [
          id,
          `${winner ? 'Public' : 'Unpublished'} theme ${id}`,
          `Description ${id}`,
          offset,
          program,
        ],
      );
      await pool.query(
        "INSERT INTO games(id,title_world,year,time_to_beat) VALUES ($1,$2,'1995',20)",
        [id, `Game ${id}`],
      );
      await pool.query(
        `INSERT INTO nominations VALUES ($1,$2,$3,$4,$5,2,$5),
        ($6,$2,'Shared relationship',false,9000,2,$5)`,
        [id * 10, program, `Nomination ${id}`, winner, id, id * 10 + 1],
      );
    }
  }
  await pool.query(`INSERT INTO nominations VALUES
    (99990,'gotm','Orphan winner',true,9000,3,NULL),
    (99991,'gotm','Missing theme',false,9000,3,99999);
    INSERT INTO completions SELECT id,CURRENT_TIMESTAMP,id,2,false FROM nominations;`);
}
