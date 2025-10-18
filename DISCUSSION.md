#Further Change Discussion

Given more time, I woulkd like to change the following:

* Schema
    As a rule I avoid changing schema as much possible, opting instead for both the business logic and the view to mutate the data according to my needs. That being said, for search to work I needed to cast the phone number as a string. There's little semantic value to storing phone numbers as strings, as this ignores international calling and extensions. The specialties list presents also a bit of a conundrum, since they also required casting to search as list. I'd add an index to make searching more performant.

* Better seeding
    Seeding a Database through an API call is not advisable since that particular migration is entirely contingent on insitutional knowledge to not run that seed function again. After some work done to address these issues that rendered no acceptable results, I resolved to leave it for now.

* Sorting and Filtering
    Extending the discussion of schema, I would have liked to include ways to sort and filter the data on the table, including filtering by speciality.